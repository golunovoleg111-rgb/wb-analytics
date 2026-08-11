// ============================================================
// PRODUCT SERVICE — BELTANEE
// Одно изделие = одна карточка; варианты = цвет/размер/артикул.
// ============================================================

import ProductAggregate from '../core/product/ProductAggregate.js';
import Database from '../infrastructure/db.js';

function clean(value) { return String(value ?? '').replace(/[\u200B-\u200D\uFEFF]/g, '').trim(); }
function normalize(value) { return clean(value).toLowerCase().replace(/\s+/g, ' '); }

export function getProductGroupKey(article) {
    const value = clean(article);
    const match = value.match(/^(\d{2,3})(?:_|$)/);
    return match ? match[1] : normalize(value.split('_')[0] || value);
}

export function getVariantKey(product) {
    return normalize(product?.articleKey || product?.article || product?.id);
}

function sortSizes(values) {
    return Array.from(new Set(values.filter(Boolean).map(clean))).sort((a, b) => {
        const na = Number(a.replace(',', '.')), nb = Number(b.replace(',', '.'));
        if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
        if (Number.isFinite(na)) return -1;
        if (Number.isFinite(nb)) return 1;
        return a.localeCompare(b, 'ru');
    });
}
function mergeName(current, candidate, key) {
    const a = clean(current), b = clean(candidate);
    if (!a || a === key) return b || a || key;
    if (!b || b === key) return a;
    return a.length <= b.length ? a : b;
}

class ProductService {
    static async createFromImport(data) { return ProductAggregate.create(data); }
    static async createManual(data) { return ProductAggregate.createManual(data); }

    static async createManyFromImport(items = []) {
        const results = [], errors = [], seen = new Set();
        for (const item of items) {
            const article = clean(item?.articleKey || item?.article || item?.id);
            const variant = getVariantKey(item);
            if (seen.has(variant)) continue;
            seen.add(variant);
            try { results.push(await this.createFromImport(item)); }
            catch (error) { errors.push({ article, error: error.message }); }
        }
        return { results, errors, skippedDuplicates: Math.max(0, items.length - results.length - errors.length) };
    }

    static async getById(id) { return ProductAggregate.getById(id); }
    static async findByArticle(article) { return ProductAggregate.findByArticle(article); }
    static async getActive() { return ProductAggregate.getActive(); }
    static async getAll() { return ProductAggregate.getAll(); }
    static async getArchived() { return ProductAggregate.getArchived(); }

    static async getByBaseModel(baseModel) {
        if (!baseModel) return [];
        const target = normalize(baseModel), targetGroup = normalize(getProductGroupKey(baseModel));
        const all = await this.getAll();
        return all.filter(product => { const group = normalize(product.productGroupKey || getProductGroupKey(product.article)); return group === targetGroup || group === target || normalize(product.article) === target; });
    }

    static async getProductGroups({ activeOnly = true } = {}) {
        const all = activeOnly ? await this.getActive() : await this.getAll();
        const groups = new Map();
        for (const product of all) {
            const article = clean(product.articleKey || product.article || product.id);
            const key = normalize(product.productGroupKey || getProductGroupKey(article));
            if (!key) continue;
            if (!groups.has(key)) groups.set(key, { id: key, productGroupKey: key, name: clean(product.name) || clean(product.title) || key, category: clean(product.category) || 'Товар', variants: [], colors: new Set(), sizes: new Set(), articles: new Set(), barcodes: new Set() });
            const group = groups.get(key);
            const variantKey = getVariantKey(product);
            if (group.variants.some(item => getVariantKey(item) === variantKey)) continue;
            group.variants.push(product);
            if (product.color) group.colors.add(clean(product.color));
            if (product.size) group.sizes.add(clean(product.size));
            if (article) group.articles.add(article);
            if (product.barcode) group.barcodes.add(clean(product.barcode));
            group.name = mergeName(group.name, product.name || product.title, key);
        }
        return Array.from(groups.values()).map(group => ({
            id: group.id, productGroupKey: group.productGroupKey, name: group.name, category: group.category,
            variants: group.variants, colors: Array.from(group.colors), sizes: sortSizes(Array.from(group.sizes)),
            articles: Array.from(group.articles), barcodes: Array.from(group.barcodes), variantCount: group.variants.length,
            colorCount: group.colors.size, sizeCount: group.sizes.size
        }));
    }

    static async getBaseModels() { return (await this.getProductGroups({ activeOnly: false })).map(group => group.productGroupKey); }
    static async update(id, data) { return ProductAggregate.update(id, data); }
    static async archive(id) { return ProductAggregate.archive(id); }
    static async restore(id) { return ProductAggregate.restore(id); }
    static async search(query) { return ProductAggregate.search(query); }
    static async getWithMetrics() { return this.getProductGroups(); }
    static async clearAll() { await Database.clear(Database.STORES.PRODUCTS); }
}

export default ProductService;
