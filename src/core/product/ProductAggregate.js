// ============================================================
// PRODUCT AGGREGATE — АГРЕГАТ ДЛЯ РАБОТЫ С ТОВАРАМИ
// ============================================================

import ProductEntity from './ProductEntity.js';
import { Database } from '../../infrastructure/db.js';

class ProductAggregate {
    
    // ============================================================
    // СОЗДАНИЕ
    // ============================================================

    static async create(data) {
        // Проверяем, существует ли товар с таким же articleKey
        const existing = await this.findByArticleKey(data.articleKey);
        if (existing) {
            throw new Error(
                `Товар с артикулом "${data.article}", размером "${data.size}" и цветом "${data.color}" уже существует`
            );
        }

        const product = ProductEntity.createFromImport(data);
        await Database.save(Database.STORES.PRODUCTS, product);
        return product;
    }

    static async createManual(data) {
        const existing = await this.findByArticleKey(data.articleKey);
        if (existing) {
            throw new Error(
                `Товар с артикулом "${data.article}", размером "${data.size}" и цветом "${data.color}" уже существует`
            );
        }

        const product = ProductEntity.createManual(data);
        await Database.save(Database.STORES.PRODUCTS, product);
        return product;
    }

    static async createMany(items) {
        const results = [];
        const errors = [];

        for (const item of items) {
            try {
                // Генерируем articleKey если не передан
                if (!item.articleKey) {
                    const size = item.size || 'NOSIZE';
                    const color = item.color || 'NOCOLOR';
                    item.articleKey = `${item.article}_${size}_${color}`;
                }
                const product = await this.create(item);
                results.push(product);
            } catch (error) {
                errors.push({ data: item, error: error.message });
            }
        }

        return { results, errors };
    }

    // ============================================================
    // ЧТЕНИЕ
    // ============================================================

    static async getById(id) {
        const data = await Database.getById(Database.STORES.PRODUCTS, id);
        if (!data) return null;
        return new ProductEntity(data);
    }

    // Поиск по article (не уникальный, возвращает массив)
    static async findByArticle(article) {
        const products = await Database.getByIndex(Database.STORES.PRODUCTS, 'article', article);
        return products.map(p => new ProductEntity(p));
    }

    // Поиск по articleKey (уникальный, возвращает один товар)
    static async findByArticleKey(articleKey) {
        const products = await Database.getByIndex(Database.STORES.PRODUCTS, 'articleKey', articleKey);
        return products.length > 0 ? new ProductEntity(products[0]) : null;
    }

    static async getActive() {
        const products = await Database.getByIndex(Database.STORES.PRODUCTS, 'status', 'active');
        return products.map(p => new ProductEntity(p));
    }

    static async getArchived() {
        const products = await Database.getByIndex(Database.STORES.PRODUCTS, 'status', 'archived');
        return products.map(p => new ProductEntity(p));
    }

    static async getAll() {
        const products = await Database.getAll(Database.STORES.PRODUCTS);
        return products.map(p => new ProductEntity(p));
    }

    // ============================================================
    // ОБНОВЛЕНИЕ
    // ============================================================

    static async update(id, data) {
        const product = await this.getById(id);
        if (!product) {
            throw new Error(`Товар с ID "${id}" не найден`);
        }

        // Проверяем уникальность articleKey при изменении
        if (data.article || data.size || data.color) {
            const newArticleKey = product._generateArticleKey(
                data.article || product.article,
                data.size || product.size,
                data.color || product.color
            );
            
            if (newArticleKey !== product.articleKey) {
                const existing = await this.findByArticleKey(newArticleKey);
                if (existing && existing.id !== id) {
                    throw new Error(
                        `Товар с артикулом "${data.article || product.article}", размером "${data.size || product.size}" и цветом "${data.color || product.color}" уже существует`
                    );
                }
            }
        }

        product.update(data);
        await Database.save(Database.STORES.PRODUCTS, product);
        return product;
    }

    // ============================================================
    // АРХИВАЦИЯ
    // ============================================================

    static async archive(id, options = {}) {
        const product = await this.getById(id);
        if (!product) {
            throw new Error(`Товар с ID "${id}" не найден`);
        }

        if (product.isArchived()) {
            throw new Error(`Товар "${product.article}" уже архивирован`);
        }

        // Проверка остатков (если передана функция)
        if (options.checkStock && typeof options.checkStock === 'function') {
            const stock = await options.checkStock(id);
            if (stock && stock.total > 0) {
                throw new Error(`Нельзя архивировать товар с остатками (${stock.total} шт)`);
            }
        }

        product.archive();
        await Database.save(Database.STORES.PRODUCTS, product);
        return product;
    }

    static async restore(id) {
        const product = await this.getById(id);
        if (!product) {
            throw new Error(`Товар с ID "${id}" не найден`);
        }

        if (product.isActive()) {
            throw new Error(`Товар "${product.article}" уже активен`);
        }

        product.restore();
        await Database.save(Database.STORES.PRODUCTS, product);
        return product;
    }

    // ============================================================
    // ПОИСК
    // ============================================================

    static async search(query) {
        const products = await this.getAll();
        const lowerQuery = query.toLowerCase();
        return products.filter(p => 
            p.article.toLowerCase().includes(lowerQuery) ||
            p.baseModel.toLowerCase().includes(lowerQuery) ||
            p.name.toLowerCase().includes(lowerQuery)
        );
    }

    // ============================================================
    // УДАЛЕНИЕ (запрещено)
    // ============================================================

    static async delete() {
        throw new Error('Товар нельзя удалить. Используйте archive() для архивации.');
    }

    static async clearAll() {
        await Database.clear(Database.STORES.PRODUCTS);
    }
}

export default ProductAggregate;
