(() => {
    'use strict';

    const PRODUCTION_HOSTS = new Set(['hyperindex.io', 'www.hyperindex.io']);
    if (!PRODUCTION_HOSTS.has(window.location.hostname)) return;

    const ALLOWED_QUERY_KEYS = new Set([
        'utm_source',
        'utm_medium',
        'utm_campaign',
        'utm_content',
    ]);

    const cleanCampaignValue = (value) => {
        if (!value) return '';
        return value.replace(/[^A-Za-z0-9._~-]/g, '_').slice(0, 80);
    };

    // GoatCounter's browser client receives location.search separately for
    // campaign parsing. Do not load it unless every query value is an expected,
    // bounded campaign tag. This excludes Stripe session references and any
    // other unknown or user-supplied parameters from analytics entirely.
    const query = new URLSearchParams(window.location.search);
    for (const [name, value] of query.entries()) {
        if (!ALLOWED_QUERY_KEYS.has(name) || cleanCampaignValue(value) !== value) return;
    }

    const campaignReferrer = () => {
        const names = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'];
        const values = names
            .map((name) => [name, cleanCampaignValue(query.get(name))])
            .filter(([, value]) => value);
        if (!values.length) return '';
        return `campaign:${values.map(([name, value]) => `${name}=${value}`).join(';')}`;
    };

    const safeReferrer = () => {
        const campaign = campaignReferrer();
        if (campaign) return campaign;
        if (!document.referrer) return '';
        try {
            const referrer = new URL(document.referrer);
            if (!['http:', 'https:'].includes(referrer.protocol)) return '';
            return `${referrer.origin}${referrer.pathname}`;
        } catch (_error) {
            return '';
        }
    };

    // Keep campaign parameters out of the reported page path and referrer. The
    // current query has already passed the strict allowlist above.
    window.goatcounter = {
        ...(window.goatcounter || {}),
        path: () => window.location.pathname || '/',
        referrer: safeReferrer,
    };

    const tracker = document.createElement('script');
    tracker.async = true;
    tracker.src = 'https://gc.zgo.at/count.js';
    tracker.dataset.goatcounter = 'https://hyperindex.goatcounter.com/count';
    document.head.appendChild(tracker);
})();
