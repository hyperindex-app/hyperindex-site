(() => {
    'use strict';

    const asset = document.body.dataset.asset;
    const key = asset.toLowerCase();
    const historyNetKey = `${key}_net_usd`;
    const historyConvictionKey = `${key}_conv`;
    const eastern = 'America/New_York';
    let historyRows = [];
    let chart = null;
    let selectedDays = 90;

    const byId = (id) => document.getElementById(id);

    const fmtUsd = (value, signed = false) => {
        const number = Number(value);
        if (!Number.isFinite(number)) return '--';
        const absolute = Math.abs(number);
        const prefix = number < 0 ? '-' : signed && number > 0 ? '+' : '';
        if (absolute >= 1e9) return `${prefix}$${(absolute / 1e9).toFixed(2)}B`;
        if (absolute >= 1e6) return `${prefix}$${(absolute / 1e6).toFixed(1)}M`;
        if (absolute >= 1e3) return `${prefix}$${(absolute / 1e3).toFixed(0)}K`;
        return `${prefix}$${absolute.toFixed(0)}`;
    };

    const fmtTime = (value) => new Intl.DateTimeFormat('en-US', {
        timeZone: eastern,
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZoneName: 'short',
    }).format(new Date(value));

    const signClass = (value) => Number(value) > 0
        ? 'text-emerald-400'
        : Number(value) < 0
            ? 'text-rose-400'
            : 'text-amber-300';

    const setSigned = (id, value, formatter = (number) => number) => {
        const element = byId(id);
        element.textContent = formatter(value);
        element.classList.remove('text-emerald-400', 'text-rose-400', 'text-amber-300');
        element.classList.add(signClass(value));
    };

    const parseRows = (rawRows) => (Array.isArray(rawRows) ? rawRows : [])
        .map((row) => ({
            timestamp: row.timestamp,
            time: new Date(row.timestamp).getTime(),
            net: Number(row[historyNetKey]),
            conviction: Number(row[historyConvictionKey]),
        }))
        .filter((row) => Number.isFinite(row.time) && Number.isFinite(row.net))
        .sort((a, b) => a.time - b.time);

    const closestTo = (target) => historyRows.reduce((best, row) => (
        !best || Math.abs(row.time - target) < Math.abs(best.time - target) ? row : best
    ), null);

    const netChange = (days, currentNet) => {
        if (!historyRows.length) return null;
        const latestTime = historyRows[historyRows.length - 1].time;
        const earlier = closestTo(latestTime - days * 86400000);
        return earlier ? currentNet - earlier.net : null;
    };

    const renderChart = () => {
        if (!historyRows.length || typeof Chart === 'undefined') return;
        const latestTime = historyRows[historyRows.length - 1].time;
        const cutoff = latestTime - selectedDays * 86400000;
        const rows = historyRows.filter((row) => row.time >= cutoff);
        const canvas = byId('assetChart');
        if (chart) chart.destroy();
        const context = canvas.getContext('2d');
        const gradient = context.createLinearGradient(0, 0, 0, 360);
        gradient.addColorStop(0, 'rgba(59, 130, 246, .28)');
        gradient.addColorStop(1, 'rgba(59, 130, 246, 0)');
        chart = new Chart(context, {
            type: 'line',
            data: {
                labels: rows.map((row) => row.timestamp),
                datasets: [{
                    label: `${asset} net position`,
                    data: rows.map((row) => row.net / 1e6),
                    borderColor: '#60a5fa',
                    backgroundColor: gradient,
                    borderWidth: 2,
                    pointRadius: 0,
                    pointHoverRadius: 3,
                    fill: true,
                    tension: .18,
                }],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                interaction: { intersect: false, mode: 'index' },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#0d1117',
                        borderColor: '#1e293b',
                        borderWidth: 1,
                        titleColor: '#e2e8f0',
                        bodyColor: '#94a3b8',
                        callbacks: {
                            title: (items) => fmtTime(items[0].label),
                            label: (item) => `Net: ${fmtUsd(item.raw * 1e6, true)}`,
                        },
                    },
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: {
                            color: '#475569',
                            maxTicksLimit: 7,
                            callback: (_value, index) => new Intl.DateTimeFormat('en-US', {
                                month: 'short', day: 'numeric', timeZone: eastern,
                            }).format(new Date(rows[index].timestamp)),
                        },
                    },
                    y: {
                        grid: { color: (ctx) => ctx.tick.value === 0 ? 'rgba(148,163,184,.3)' : 'rgba(255,255,255,.04)' },
                        ticks: { color: '#475569', callback: (value) => `${value < 0 ? '-' : ''}$${Math.abs(value)}M` },
                        title: { display: true, text: 'Net notional ($M)', color: '#475569' },
                    },
                },
            },
        });
    };

    const render = (indexData, historyData) => {
        const current = (indexData.assets || []).find((row) => row.asset === asset);
        if (!current) throw new Error('asset_missing');
        historyRows = parseRows(historyData.hourly);
        if (!historyRows.length) throw new Error('history_missing');

        const currentNet = Number(current.net_usd);
        const tilt = Number(current.tilt);
        const conviction = Number(current.conv_equity);
        const longCount = Number(current.long_count || 0);
        const shortCount = Number(current.short_count || 0);
        const totalCount = Number(current.position_count || longCount + shortCount);
        const netLabel = currentNet > 0 ? 'Net long' : currentNet < 0 ? 'Net short' : 'Balanced';

        byId('updatedAt').textContent = `Updated ${fmtTime(indexData.generated_at)}`;
        setSigned('netPosition', currentNet, (value) => fmtUsd(value, true));
        byId('netRegime').textContent = netLabel;
        setSigned('tilt', tilt, (value) => `${value > 0 ? '+' : ''}${(value * 100).toFixed(0)}%`);
        byId('traderBalance').textContent = `${longCount}L / ${shortCount}S`;
        byId('traderCount').textContent = `${totalCount} traders with open ${asset} positions`;
        setSigned('conviction', conviction, (value) => `${value > 0 ? '+' : ''}${value.toFixed(2)}`);
        byId('grossLong').textContent = fmtUsd(current.long_usd);
        byId('grossShort').textContent = fmtUsd(current.short_usd);
        byId('longCount').textContent = String(longCount);
        byId('shortCount').textContent = String(shortCount);
        byId('currentSummary').textContent = `The 100 currently hold ${fmtUsd(currentNet, true)} net in ${asset}. ${shortCount} of ${totalCount} traders with open ${asset} positions are short, and the aggregate tilt is ${(Math.abs(tilt) * 100).toFixed(0)}% ${tilt < 0 ? 'short' : tilt > 0 ? 'long' : 'balanced'}. This describes positioning rather than an expected price direction.`;

        setSigned('change24h', netChange(1, currentNet), (value) => value === null ? '--' : fmtUsd(value, true));
        setSigned('change7d', netChange(7, currentNet), (value) => value === null ? '--' : fmtUsd(value, true));
        setSigned('change30d', netChange(30, currentNet), (value) => value === null ? '--' : fmtUsd(value, true));

        const latestTime = historyRows[historyRows.length - 1].time;
        const window90 = historyRows.filter((row) => row.time >= latestTime - 90 * 86400000);
        byId('mostLong').textContent = fmtUsd(Math.max(...window90.map((row) => row.net)), true);
        byId('mostShort').textContent = fmtUsd(Math.min(...window90.map((row) => row.net)), true);

        document.querySelectorAll('.range-button').forEach((button) => {
            button.addEventListener('click', () => {
                selectedDays = Number(button.dataset.days);
                document.querySelectorAll('.range-button').forEach((candidate) => {
                    candidate.setAttribute('aria-pressed', String(candidate === button));
                });
                renderChart();
            });
        });
        renderChart();
        byId('pageContent').classList.remove('hidden');
    };

    Promise.all([
        fetch('../data/index_latest.json', { cache: 'no-store' }).then((response) => {
            if (!response.ok) throw new Error('index_request_failed');
            return response.json();
        }),
        fetch('../data/history.json', { cache: 'no-store' }).then((response) => {
            if (!response.ok) throw new Error('history_request_failed');
            return response.json();
        }),
    ])
        .then(([indexData, historyData]) => render(indexData, historyData))
        .catch(() => byId('loadError').classList.remove('hidden'));
})();
