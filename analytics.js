(() => {
    'use strict';

    const PRODUCTION_HOSTS = new Set(['hyperindex.io', 'www.hyperindex.io']);
    if (!PRODUCTION_HOSTS.has(window.location.hostname)) return;

    const cleanCampaignValue = (value) => {
        if (!value) return '';
        return value.replace(/[^A-Za-z0-9._~-]/g, '_').slice(0, 80);
    };

    const campaignReferrer = () => {
        const query = new URLSearchParams(window.location.search);
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

    // Never send URL queries. The post-checkout welcome URL contains a Stripe
    // session reference, and inbound links may contain arbitrary parameters.
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
