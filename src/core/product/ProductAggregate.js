// ============================================================
// PRODUCT AGGREGATE
// Агрегат товара — управляет правилами и инвариантами
// ============================================================

import ProductEntity from './ProductEntity.js';
import Database from '../../infrastructure/db.js';

/**
 * ProductAggregate — управляет товарами
 * 
 * Отвечает за:
 *   - создание товаров (с проверкой уникальности артикула)
 *   - обновление товаров
 *   - архивацию товаров (с проверкой правил)
 *   - получение товаров
 * 
 * Инварианты:
 *   - Артикул уникален
 *   - Товар нельзя архивировать, если есть остатки > 0
 *   - Товар нельзя удалить (только архивировать)
 */
class ProductAggregate {
    
    // ============================================================
    // СОЗДАНИЕ
    // ============================================================

    /**
     * Создать новый товар
     */
    static async create(data) {
        // Проверяем, существует ли товар с таким артикулом
        const existing = await this.findByArticle(data.article);
        if (existing) {
            throw new Error(`Товар с артикулом "${data.article}" уже существует`);
        }

        // Создаём сущность
        const product = ProductEntity.createFromImport(data);
        
        // Сохраняем в БД
        await Database.save(Database.STORES.PRODUCTS, product);
        
        return product;
    }

    /**
     * Создать товар вручную
     */
    static async createManual(data) {
        const existing = await this.findByArticle(data.article);
        if (existing) {
            throw new Error(`Товар с артикулом "${data.article}" уже существует`);
        }

        const product = ProductEntity.createManual(data);
        await Database.save(Database.STORES.PRODUCTS, product);
        
        return product;
    }

    // ============================================================
    // ЧТЕНИЕ
    // ============================================================

    /**
     * Получить товар по ID
     */
    static async getById(id) {
        const data = await Database.getById(Database.STORES.PRODUCTS, id);
        if (!data) return null;
        return new ProductEntity(data);
    }

    /**
     * Получить товар по артикулу
     */
    static async findByArticle(article) {
        const products = await Database.getByIndex(
            Database.STORES.PRODUCTS,
            'article',
            article
        );
        return products.length > 0 ? new ProductEntity(products[0]) : null;
    }

    /**
     * Получить все активные товары
     */
    static async getActive() {
        const products = await Database.getByIndex(
            Database.STORES.PRODUCTS,
            'status',
            'active'
        );
        return products.map(p => new ProductEntity(p));
    }

    /**
     * Получить все архивированные товары
     */
    static async getArchived() {
        const products = await Database.getByIndex(
            Database.STORES.PRODUCTS,
            'status',
            'archived'
        );
        return products.map(p => new ProductEntity(p));
    }

    /**
     * Получить все товары
     */
    static async getAll() {
        const products = await Database.getAll(Database.STORES.PRODUCTS);
        return products.map(p => new ProductEntity(p));
    }

    // ============================================================
    // ОБНОВЛЕНИЕ
    // ============================================================

    /**
     * Обновить товар
     */
    static async update(id, data) {
        const product = await this.getById(id);
        if (!product) {
            throw new Error(`Товар с ID "${id}" не найден`);
        }

        // Проверяем, не занят ли новый артикул другим товаром
        if (data.article && data.article !== product.article) {
            const existing = await this.findByArticle(data.article);
            if (existing && existing.id !== id) {
                throw new Error(`Артикул "${data.article}" уже используется другим товаром`);
            }
        }

        product.update(data);
        await Database.save(Database.STORES.PRODUCTS, product);
        
        return product;
    }

    // ============================================================
    // АРХИВАЦИЯ
    // ============================================================

    /**
     * Архивировать товар
     * Проверяет, что остатки равны 0 и нет активных поставок
     */
    static async archive(id, options = {}) {
        const product = await this.getById(id);
        if (!product) {
            throw new Error(`Товар с ID "${id}" не найден`);
        }

        if (product.isArchived()) {
            throw new Error(`Товар "${product.article}" уже архивирован`);
        }

        // Проверяем остатки (если передан колбэк для проверки)
        if (options.checkStock && typeof options.checkStock === 'function') {
            const stock = await options.checkStock(id);
            if (stock && stock.total > 0) {
                throw new Error(`Нельзя архивировать товар с остатками (${stock.total} шт)`);
            }
        }

        // Проверяем поставки (если передан колбэк для проверки)
        if (options.checkSupply && typeof options.checkSupply === 'function') {
            const hasActiveSupply = await options.checkSupply(id);
            if (hasActiveSupply) {
                throw new Error('Нельзя архивировать товар с активными поставками');
            }
        }

        product.archive();
        await Database.save(Database.STORES.PRODUCTS, product);
        
        return product;
    }

    /**
     * Восстановить товар из архива
     */
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
    // УДАЛЕНИЕ (запрещено)
    // ============================================================

    /**
     * Удалить товар нельзя — только архивировать
     */
    static async delete() {
        throw new Error('Товар нельзя удалить. Используйте archive() для архивации.');
    }

    // ============================================================
    // ПОИСК
    // ============================================================

    /**
     * Поиск товаров по части артикула
     */
    static async search(query) {
        const products = await this.getAll();
        const lowerQuery = query.toLowerCase();
        return products.filter(p => 
            p.article.toLowerCase().includes(lowerQuery) ||
            p.baseArticle.toLowerCase().includes(lowerQuery)
        );
    }
}

// ============================================================
// ЭКСПОРТ
// ============================================================

export default ProductAggregate;
