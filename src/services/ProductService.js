// ============================================================
// PRODUCT SERVICE
// Сервис для работы с товарами (для UI)
// ============================================================

import ProductAggregate from '../core/product/ProductAggregate.js';
import Database from '../infrastructure/db.js';

/**
 * ProductService — предоставляет API для UI
 * 
 * Отвечает за:
 *   - получение списков товаров для отображения
 *   - создание, обновление, архивацию
 *   - поиск
 *   - генерацию событий
 */
class ProductService {
    
    // ============================================================
    // СОЗДАНИЕ
    // ============================================================

    /**
     * Создать товар из импорта
     */
    static async createFromImport(data) {
        try {
            const product = await ProductAggregate.create(data);
            
            this._emitEvent('ProductCreated', {
                productId: product.id,
                article: product.article,
                source: 'import'
            });
            
            return product;
        } catch (error) {
            console.error('[ProductService] createFromImport error:', error.message);
            throw error;
        }
    }

    /**
     * Создать товар вручную
     */
    static async createManual(data) {
        try {
            const product = await ProductAggregate.createManual(data);
            
            this._emitEvent('ProductCreated', {
                productId: product.id,
                article: product.article,
                source: 'manual'
            });
            
            return product;
        } catch (error) {
            console.error('[ProductService] createManual error:', error.message);
            throw error;
        }
    }

    /**
     * Создать несколько товаров из импорта
     */
    static async createManyFromImport(items) {
        const results = [];
        const errors = [];
        
        for (const item of items) {
            try {
                const product = await this.createFromImport(item);
                results.push(product);
            } catch (error) {
                errors.push({
                    article: item.article,
                    error: error.message
                });
            }
        }
        
        return { results, errors };
    }

    // ============================================================
    // ЧТЕНИЕ
    // ============================================================

    /**
     * Получить товар по ID
     */
    static async getById(id) {
        return await ProductAggregate.getById(id);
    }

    /**
     * Получить товар по артикулу (возвращает массив, т.к. артикул не уникален)
     */
    static async findByArticle(article) {
        return await ProductAggregate.findByArticle(article);
    }

    /**
     * Получить все активные товары
     */
    static async getActive() {
        return await ProductAggregate.getActive();
    }

    /**
     * Получить все товары
     */
    static async getAll() {
        return await ProductAggregate.getAll();
    }

    /**
     * Получить архивированные товары
     */
    static async getArchived() {
        return await ProductAggregate.getArchived();
    }

    // ============================================================
    // ПОЛУЧИТЬ ТОВАРЫ ПО БАЗЕ АРТИКУЛА (НОВЫЙ МЕТОД)
    // ============================================================

    /**
     * Получить все товары, относящиеся к одной базе (модели)
     * Например: baseModel = "21_К_Вельвет" → все размеры и цвета
     */
    static async getByBaseModel(baseModel) {
        if (!baseModel) return [];
        const all = await this.getAll();
        return all.filter(p => 
            p.baseModel === baseModel || 
            p.article === baseModel ||
            (p.articleKey && p.articleKey.startsWith(baseModel + '|'))
        );
    }

    /**
     * Получить список всех уникальных базовых моделей
     */
    static async getBaseModels() {
        const all = await this.getAll();
        const bases = new Set();
        all.forEach(p => {
            const base = p.baseModel || p.article;
            if (base) bases.add(base);
        });
        return Array.from(bases);
    }

    // ============================================================
    // ОБНОВЛЕНИЕ
    // ============================================================

    /**
     * Обновить товар
     */
    static async update(id, data) {
        try {
            const product = await ProductAggregate.update(id, data);
            
            this._emitEvent('ProductUpdated', {
                productId: product.id,
                article: product.article,
                changes: data
            });
            
            return product;
        } catch (error) {
            console.error('[ProductService] update error:', error.message);
            throw error;
        }
    }

    // ============================================================
    // АРХИВАЦИЯ
    // ============================================================

    /**
     * Архивировать товар
     */
    static async archive(id, options = {}) {
        try {
            const product = await ProductAggregate.archive(id, options);
            
            this._emitEvent('ProductArchived', {
                productId: product.id,
                article: product.article,
                archivedAt: product.archivedAt
            });
            
            return product;
        } catch (error) {
            console.error('[ProductService] archive error:', error.message);
            throw error;
        }
    }

    /**
     * Восстановить товар из архива
     */
    static async restore(id) {
        try {
            const product = await ProductAggregate.restore(id);
            
            this._emitEvent('ProductRestored', {
                productId: product.id,
                article: product.article
            });
            
            return product;
        } catch (error) {
            console.error('[ProductService] restore error:', error.message);
            throw error;
        }
    }

    // ============================================================
    // ПОИСК
    // ============================================================

    /**
     * Поиск товаров
     */
    static async search(query) {
        return await ProductAggregate.search(query);
    }

    // ============================================================
    // ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ (для UI)
    // ============================================================

    /**
     * Получить товары с дополнительными метриками (для списка)
     */
    static async getWithMetrics() {
        const products = await this.getActive();
        return products;
    }

    // ============================================================
    // СОБЫТИЯ
    // ============================================================

    static _eventListeners = {};

    static on(eventName, callback) {
        if (!this._eventListeners[eventName]) {
            this._eventListeners[eventName] = [];
        }
        this._eventListeners[eventName].push(callback);
    }

    static _emitEvent(eventName, data) {
        const listeners = this._eventListeners[eventName] || [];
        listeners.forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                console.error(`[ProductService] Event listener error for ${eventName}:`, error);
            }
        });
    }

    // ============================================================
    // ОЧИСТКА
    // ============================================================

    /**
     * Очистить все товары (использовать с осторожностью!)
     */
    static async clearAll() {
        await Database.clear(Database.STORES.PRODUCTS);
    }
}

export default ProductService;
