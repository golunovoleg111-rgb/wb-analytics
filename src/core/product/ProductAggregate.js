// ============================================================
// PRODUCT AGGREGATE — ИЗДЕЛИЯ И ВАРИАНТЫ
// ============================================================

import ProductEntity from './ProductEntity.js';
import { Database } from '../../infrastructure/db.js';

class ProductAggregate {
    static async create(data) {
        const product = ProductEntity.createFromImport(data);
        const existing = await this.findByArticleKey(product.articleKey);
        if (existing) {
            existing.update({ ...data, articleKey: product.articleKey });
            await Database.save(Database.STORES.PRODUCTS, existing);
            return existing;
        }
        await Database.save(Database.STORES.PRODUCTS, product);
        return product;
    }

    static async createManual(data) { return this.create({ ...data, status: 'active' }); }

    static async createMany(items) {
        const results = [], errors = [];
        for (const item of items || []) {
            try { results.push(await this.create(item)); }
            catch (error) { errors.push({ data: item, error: error.message }); }
        }
        return { results, errors };
    }

    static async getById(id) {
        const data = await Database.getById(Database.STORES.PRODUCTS, id);
        return data ? new ProductEntity(data) : null;
    }

    static async findByArticle(article) {
        const value = String(article ?? '').trim();
        const products = await Database.getByIndex(Database.STORES.PRODUCTS, 'article', value);
        return products.map(item => new ProductEntity(item));
    }

    static async findByArticleKey(articleKey) {
        const value = String(articleKey ?? '').trim();
        if (!value) return null;
        const products = await Database.getByIndex(Database.STORES.PRODUCTS, 'articleKey', value);
        return products.length ? new ProductEntity(products[0]) : null;
    }

    static async getActive() {
        return (await Database.getByIndex(Database.STORES.PRODUCTS, 'status', 'active')).map(item => new ProductEntity(item));
    }

    static async getArchived() {
        return (await Database.getByIndex(Database.STORES.PRODUCTS, 'status', 'archived')).map(item => new ProductEntity(item));
    }

    static async getAll() {
        return (await Database.getAll(Database.STORES.PRODUCTS)).map(item => new ProductEntity(item));
    }

    /**
     * Главная бизнес-модель: одна карточка = одно изделие.
     * Например 21_* и 21_* с разными цветами/размерами → одна группа 21.
     * 211_* остаётся отдельной группой.
     */
    static async getProductGroups() {
        const variants = await this.getActive();
        const groups = new Map();
        for (const variant of variants) {
            const key = variant.productGroupKey || variant.baseModel || variant.article;
            if (!groups.has(key)) {
                groups.set(key, {
                    productGroupKey: key,
                    name: variant.name || variant.baseModel || key,
                    category: variant.category,
                    variants: [],
                    colors: new Set(),
                    sizes: new Set(),
                    articles: new Set(),
                    barcodes: new Set(),
                    prices: []
                });
            }
            const group = groups.get(key);
            group.variants.push(variant);
            if (variant.color) group.colors.add(variant.color);
            if (variant.size) group.sizes.add(variant.size);
            if (variant.article) group.articles.add(variant.article);
            if (variant.barcode) group.barcodes.add(variant.barcode);
            if (variant.price > 0) group.prices.push(variant.price);
            if (!group.name || group.name === key) group.name = variant.name || group.name;
        }
        return Array.from(groups.values()).map(group => ({
            productGroupKey: group.productGroupKey,
            name: group.name,
            category: group.category,
            variants: group.variants,
            colors: Array.from(group.colors),
            sizes: Array.from(group.sizes),
            articles: Array.from(group.articles),
            barcodes: Array.from(group.barcodes),
            variantCount: group.variants.length,
            minPrice: group.prices.length ? Math.min(...group.prices) : 0,
            maxPrice: group.prices.length ? Math.max(...group.prices) : 0
        }));
    }

    static async getByProductGroup(productGroupKey) {
        const key = String(productGroupKey ?? '').trim();
        if (!key) return [];
        const all = await this.getAll();
        return all.filter(product => product.productGroupKey === key);
    }

    static async search(query = '') {
        const value = String(query).trim().toLowerCase();
        const products = await this.getAll();
        if (!value) return products;
        return products.filter(product =>
            [product.productGroupKey, product.article, product.baseModel, product.name, product.barcode, product.color, product.size]
                .some(field => String(field || '').toLowerCase().includes(value))
        );
    }

    static async update(id, data) {
        const product = await this.getById(id);
        if (!product) throw new Error(`Товар с ID "${id}" не найден`);
        product.update(data);
        await Database.save(Database.STORES.PRODUCTS, product);
        return product;
    }

    static async archive(id) {
        const product = await this.getById(id);
        if (!product) throw new Error(`Товар с ID "${id}" не найден`);
        product.archive();
        await Database.save(Database.STORES.PRODUCTS, product);
        return product;
    }

    static async restore(id) {
        const product = await this.getById(id);
        if (!product) throw new Error(`Товар с ID "${id}" не найден`);
        product.restore();
        await Database.save(Database.STORES.PRODUCTS, product);
        return product;
    }

    static async clearAll() { await Database.clear(Database.STORES.PRODUCTS); }
}

export default ProductAggregate;
