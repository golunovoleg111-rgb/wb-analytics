// ============================================================
// PRODUCT SERVICE — BELTANEE
// Логическая модель товара: одно изделие = одна карточка,
// внутри которой находятся цвета, размеры и артикулы вариантов.
// ============================================================

import ProductAggregate from '../core/product/ProductAggregate.js';
import Database from '../infrastructure/db.js';

function clean(value) { return String(value ?? '').replace(/[\u200B-\u200D\uFEFF]/g, '').trim(); }
function normalize(value) { return clean(value).toLowerCase().replace(/\s+/g, ' '); }

export function getProductGroupKey(article) {
    const value = clean(article);
    const match = value.match(/^(\d+)/);
    return match ? match[1] : normalize(value.split('_')[0] || value);
}

export function getVariantKey(product) {
    return normalize(product?.articleKey || product?.article || product?.id);
}

class ProductService {
    static async createFromImport(data) {
        try {
            const product = await ProductAggregate.create(data);
            this._emitEvent('ProductCreated', { productId: product.id, article: product.article, source: 'import' });
            return product;
        } catch (error) { console.error('[ProductService] createFromImport error:', error.message); throw error; }
    }

    static async createManual(data) {
        try {
            const product = await ProductAggregate.createManual(data);
            this._emitEvent('ProductCreated', { productId: product.id, article: product.article, source: 'manual' });
            return product;
        } catch (error) { console.error('[ProductService] createManual error:', error.message); throw error; }
    }

    static async createManyFromImport(items) {
        const results = [], errors = [];
        for (const item of items) {
            try { results.push(await this.createFromImport(item)); }
            catch (error) { errors.push({ article: item.article, error: error.message }); }
        }
        return { results, errors };
    }

    static async getById(id) { return ProductAggregate.getById(id); }
    static async findByArticle(article) { return ProductAggregate.findByArticle(article); }
    static async getActive() { return ProductAggregate.getActive(); }
    static async getAll() { return ProductAggregate.getAll(); }
    static async getArchived() { return ProductAggregate.getArchived(); }

    /**
     * Получить все варианты одного физического изделия.
     * Принимает как новый groupKey (21), так и старый baseModel (21_К_Вельвет),
     * поэтому переход на новую модель данных не ломает уже сохранённые записи.
     */
    static async getByBaseModel(baseModel) {
        if (!baseModel) return [];
        const target = normalize(baseModel);
        const targetGroup = getProductGroupKey(baseModel);
        const all = await this.getAll();
        return all.filter(product => {
            const groupKey = normalize(product.productGroupKey || product.baseModel || getProductGroupKey(product.article));
            return groupKey === target || groupKey === targetGroup || normalize(product.article) === target;
        });
    }

    /**
     * Возвращает уникальные изделия, а не строки вариантов.
     * Один код 21 = одна карточка, независимо от количества цветов/размеров.
     */
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
                    baseModel: key,
                    name: clean(product.name) || clean(product.title) || key,
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
            if ((!group.name || group.name === key) && product.name) group.name = product.name;
        }

        return Array.from(groups.values()).map(group => ({
            ...group,
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
        const groups = await this.getProductGroups({ activeOnly: false });
        return groups.map(group => group.productGroupKey);
    }

    static async update(id, data) {
        try {
            const product = await ProductAggregate.update(id, data);
            this._emitEvent('ProductUpdated', { productId: product.id, article: product.article, changes: data });
            return product;
        } catch (error) { console.error('[ProductService] update error:', error.message); throw error; }
    }

    static async archive(id, options = {}) {
        try {
            const product = await ProductAggregate.archive(id, options);
            this._emitEvent('ProductArchived', { productId: product.id, article: product.article, archivedAt: product.archivedAt });
            return product;
        } catch (error) { console.error('[ProductService] archive error:', error.message); throw error; }
    }

    static async restore(id) {
        try {
            const product = await ProductAggregate.restore(id);
            this._emitEvent('ProductRestored', { productId: product.id, article: product.article });
            return product;
        } catch (error) { console.error('[ProductService] restore error:', error.message); throw error; }
    }

    static async search(query) { return ProductAggregate.search(query); }
    static async getWithMetrics() { return this.getActive(); }

    static _eventListeners = {};
    static on(eventName, callback) {
        if (!this._eventListeners[eventName]) this._eventListeners[eventName] = [];
        this._eventListeners[eventName].push(callback);
    }
    static _emitEvent(eventName, data) {
        (this._eventListeners[eventName] || []).forEach(callback => {
            try { callback(data); } catch (error) { console.error(`[ProductService] Event listener error for ${eventName}:`, error); }
        });
    }

    static async clearAll() { await Database.clear(Database.STORES.PRODUCTS); }
}

export default ProductService;
