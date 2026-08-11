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

class ProductService {
    static async createFromImport(data) { return ProductAggregate.create(data); }
    static async createManual(data) { return ProductAggregate.createManual(data); }

    static async createManyFromImport(items = []) {
        const results = [], errors = [];
        for (const item of items) {
            try { results.push(await this.createFromImport(item)); }
            catch (error) { errors.push({ article: item?.article, error: error.message }); }
        }
        return { results, errors };
    }

    static async getById(id) { return ProductAggregate.getById(id); }
    static async findByArticle(article) { return ProductAggregate.findByArticle(article); }
    static async getActive() { return ProductAggregate.getActive(); }
    static async getAll() { return ProductAggregate.getAll(); }
    static async getArchived() { return ProductAggregate.getArchived(); }

    static async getByBaseModel(baseModel) {
        if (!baseModel) return [];
        const target = normalize(baseModel);
        const targetGroup = normalize(getProductGroupKey(baseModel));
        const all = await this.getAll();
        return all.filter(product => {
            const group = normalize(product.productGroupKey || getProductGroupKey(product.article));
            return group === targetGroup || group === target || normalize(product.article) === target;
        });
    }

    static async getProductGroups({ activeOnly = true } = {}) {
        const all = activeOnly ? await this.getActive() : await this.getAll();
        const groups = new Map();
        for (const product of all) {
            const key = normalize(product.productGroupKey || getProductGroupKey(product.article));
            if (!key) continue;
            if (!groups.has(key)) {
                groups.set(key, {
                    id: key,
                    productGroupKey: key,
                    name: clean(product.name) || clean(product.title) || key,
                    category: clean(product.category) || 'Товар',
                    variants: [],
                    colors: new Set(),
                    sizes: new Set(),
                    articles: new Set(),
                    barcodes: new Set()
                });
            }
            const group = groups.get(key);
            group.variants.push(product);
            if (product.color) group.colors.add(product.color);
            if (product.size) group.sizes.add(product.size);
            if (product.article) group.articles.add(product.article);
            if (product.barcode) group.barcodes.add(product.barcode);
            if (!group.name || group.name === key) group.name = clean(product.name) || group.name;
        }
        return Array.from(groups.values()).map(group => ({
            id: group.id,
            productGroupKey: group.productGroupKey,
            name: group.name,
            category: group.category,
            variants: group.variants,
            colors: Array.from(group.colors),
            sizes: Array.from(group.sizes),
            articles: Array.from(group.articles),
            barcodes: Array.from(group.barcodes),
            variantCount: group.variants.length,
            colorCount: group.colors.size,
            sizeCount: group.sizes.size
        }));
    }

    static async getBaseModels() {
        return (await this.getProductGroups({ activeOnly: false })).map(group => group.productGroupKey);
    }

    static async update(id, data) { return ProductAggregate.update(id, data); }
    static async archive(id) { return ProductAggregate.archive(id); }
    static async restore(id) { return ProductAggregate.restore(id); }
    static async search(query) { return ProductAggregate.search(query); }
    static async getWithMetrics() { return this.getProductGroups(); }

    static async clearAll() { await Database.clear(Database.STORES.PRODUCTS); }
}

export default ProductService;
