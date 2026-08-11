// ============================================================
// PRODUCT AGGREGATE — ТОВАРЫ
// ============================================================

import ProductEntity from './ProductEntity.js';
import { Database } from '../../infrastructure/db.js';

class ProductAggregate {
    static async create(data) {
        const normalized = { ...data };
        normalized.articleKey = normalized.articleKey || new ProductEntity(normalized).articleKey;

        const existing = await this.findByArticleKey(normalized.articleKey);
        if (existing) {
            existing.update(normalized);
            await Database.save(Database.STORES.PRODUCTS, existing);
            return existing;
        }

        const product = ProductEntity.createFromImport(normalized);
        await Database.save(Database.STORES.PRODUCTS, product);
        return product;
    }

    static async createManual(data) {
        const product = await this.create({ ...data, status: 'active' });
        return product;
    }

    static async createMany(items) {
        const results = [];
        const errors = [];

        for (const item of items || []) {
            try {
                results.push(await this.create(item));
            } catch (error) {
                errors.push({ data: item, error: error.message });
            }
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
        const products = await Database.getByIndex(Database.STORES.PRODUCTS, 'status', 'active');
        return products.map(item => new ProductEntity(item));
    }

    static async getArchived() {
        const products = await Database.getByIndex(Database.STORES.PRODUCTS, 'status', 'archived');
        return products.map(item => new ProductEntity(item));
    }

    static async getAll() {
        const products = await Database.getAll(Database.STORES.PRODUCTS);
        return products.map(item => new ProductEntity(item));
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

    static async search(query = '') {
        const value = String(query).trim().toLowerCase();
        const products = await this.getAll();
        if (!value) return products;
        return products.filter(product =>
            [product.article, product.baseModel, product.name, product.barcode]
                .some(field => String(field || '').toLowerCase().includes(value))
        );
    }

    static async clearAll() {
        await Database.clear(Database.STORES.PRODUCTS);
    }
}

export default ProductAggregate;
