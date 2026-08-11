// ============================================================
// PRODUCT PARSER — BELTANEE
// Парсер не угадывает цвет и не меняет исходный артикул.
// ============================================================

const RU_SIZE_RE = /^(?:3[6-9]|4[0-9]|5[0-9]|6[0-4])$/;

function clean(value) {
    return String(value ?? '').replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
}

function normalize(value) {
    return clean(value).toLowerCase().replace(/\s+/g, ' ');
}

function extractProductGroupKey(article) {
    const value = clean(article);
    const match = value.match(/^(\d{2,3})(?:_|$)/);
    return match ? match[1] : '';
}

function splitArticle(article) {
    return clean(article).split('_').filter(Boolean);
}

function findSizeToken(parts, suppliedSize = '') {
    const explicit = clean(suppliedSize);
    if (explicit) return explicit;
    for (let i = parts.length - 1; i >= 0; i -= 1) {
        if (RU_SIZE_RE.test(parts[i])) return parts[i];
    }
    return '';
}

function findColor(parts, size) {
    const copy = [...parts];
    if (size) {
        const index = copy.findIndex(part => part === size);
        if (index >= 0) copy.splice(index, 1);
    }
    return copy.length > 1 ? copy.slice(1).join('_') : '';
}

export function parseProductArticle(article, options = {}) {
    const originalArticle = clean(article);
    const parts = splitArticle(originalArticle);
    const productGroupKey = extractProductGroupKey(originalArticle);
    const suppliedSize = clean(options.size);
    const suppliedColor = clean(options.color);
    const size = findSizeToken(parts, suppliedSize);
    const color = suppliedColor || findColor(parts, size);
    return {
        originalArticle,
        productGroupKey: productGroupKey || normalize(parts[0] || originalArticle),
        size,
        color,
        parts,
        normalizedArticle: normalize(originalArticle)
    };
}

export function makeVariantKey(parsed, barcode = '') {
    const article = normalize(parsed?.originalArticle);
    const code = clean(barcode);
    return code ? `${article}|barcode:${code}` : `${article}|size:${normalize(parsed?.size)}|color:${normalize(parsed?.color)}`;
}

export function isRussianSize(value) {
    return RU_SIZE_RE.test(clean(value));
}

export default { parseProductArticle, makeVariantKey, isRussianSize };
