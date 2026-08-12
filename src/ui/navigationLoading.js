// ============================================================
// BELTANEE — UNIFIED NAVIGATION / LOADING LAYER
// v1.7.1
// ============================================================

const STYLE_ID = 'beltanee-navigation-loading-styles';
const OVERLAY_ID = 'beltanee-navigation-loading';
let installed = false;
let navigating = false;

function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
        #${OVERLAY_ID}{position:fixed;inset:0;z-index:8000;pointer-events:none;opacity:0;transition:opacity .16s ease;background:rgba(248,250,252,.42);backdrop-filter:blur(1.5px)}
        #${OVERLAY_ID}.is-visible{opacity:1}
        #${OVERLAY_ID} .beltanee-loading-card{position:absolute;top:88px;left:50%;transform:translateX(-50%);width:min(420px,calc(100% - 32px));padding:14px 16px;border:1px solid rgba(15,23,42,.08);border-radius:14px;background:rgba(255,255,255,.94);box-shadow:0 12px 40px rgba(15,23,42,.10);display:flex;align-items:center;gap:12px}
        #${OVERLAY_ID} .beltanee-spinner{width:18px;height:18px;border:2px solid rgba(15,23,42,.12);border-top-color:currentColor;border-radius:50%;animation:beltaneeSpin .7s linear infinite;flex:0 0 auto}
        #${OVERLAY_ID} .beltanee-loading-text{font-size:13px;font-weight:600;color:var(--text-primary,#172033)}
        #${OVERLAY_ID} .beltanee-loading-sub{font-size:11px;font-weight:400;color:var(--text-secondary,#64748b);margin-top:2px}
        .beltanee-page-transition{animation:beltaneePageIn .22s ease both}
        @keyframes beltaneeSpin{to{transform:rotate(360deg)}}
        @keyframes beltaneePageIn{from{opacity:.35;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}
        @media(prefers-reduced-motion:reduce){#${OVERLAY_ID},.beltanee-page-transition{transition:none;animation:none}#${OVERLAY_ID} .beltanee-spinner{animation:none}}
    `;
    document.head.appendChild(style);
}

function ensureOverlay() {
    let overlay = document.getElementById(OVERLAY_ID);
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.innerHTML = '<div class="beltanee-loading-card"><div class="beltanee-spinner"></div><div><div class="beltanee-loading-text">Загружаем раздел…</div><div class="beltanee-loading-sub">Подготавливаем расчёты и данные</div></div></div>';
    document.body.appendChild(overlay);
    return overlay;
}

function show(message = 'Загружаем раздел…') {
    const overlay = ensureOverlay();
    const text = overlay.querySelector('.beltanee-loading-text');
    if (text) text.textContent = message;
    overlay.classList.add('is-visible');
}

function hide() {
    const overlay = document.getElementById(OVERLAY_ID);
    if (overlay) overlay.classList.remove('is-visible');
}

function activePageId() {
    return document.querySelector('.page.active')?.id?.replace('page-', '') || '';
}

function syncDemoBar(page) {
    const bar = document.getElementById('demoExperienceBar');
    if (!bar) return;
    bar.style.display = page === 'dashboard' ? '' : 'none';
}

async function waitForPage(page, previousHtml, timeout = 2500) {
    const started = performance.now();
    while (performance.now() - started < timeout) {
        const element = document.getElementById(`page-${page}`);
        const active = activePageId();
        if (element && active === page) {
            const html = element.innerHTML.trim();
            if (html && html !== previousHtml && !/Загрузка|Загружаем/i.test(html.slice(0, 180))) {
                element.classList.remove('beltanee-page-transition');
                void element.offsetWidth;
                element.classList.add('beltanee-page-transition');
                return true;
            }
        }
        await new Promise(resolve => setTimeout(resolve, 40));
    }
    return false;
}

export function installNavigationLoading() {
    if (installed) return;
    installed = true;
    ensureStyles();
    ensureOverlay();

    const originalNavigate = window.navigateTo;
    if (typeof originalNavigate !== 'function') return;
    if (originalNavigate.__beltaneeNavigationLoading) return;

    const navigate = function(page) {
        if (navigating) return originalNavigate(page);
        const target = document.getElementById(`page-${page}`);
        const previousHtml = target?.innerHTML?.trim() || '';
        navigating = true;
        show('Открываем раздел…');
        syncDemoBar(page);

        let result;
        try { result = originalNavigate(page); } catch (error) { navigating = false; hide(); throw error; }

        Promise.resolve(result).then(async () => {
            await waitForPage(page, previousHtml);
            syncDemoBar(page);
            hide();
            navigating = false;
        }).catch(() => { hide(); navigating = false; });

        return result;
    };

    navigate.__beltaneeNavigationLoading = true;
    navigate.__beltaneeOriginal = originalNavigate;
    window.navigateTo = navigate;
    window.beltaneeNavigationLoading = { show, hide, syncDemoBar };

    window.addEventListener('beltanee:data-updated', () => {
        const page = activePageId();
        if (page) syncDemoBar(page);
    });
}

export { show as showNavigationLoading, hide as hideNavigationLoading };
