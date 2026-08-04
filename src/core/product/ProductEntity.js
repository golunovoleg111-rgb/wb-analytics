// ============================================================
// PRODUCT ENTITY
// Сущность товара — только данные, без логики
// ============================================================

/**
 * Product — сущность товара
 * 
 * Содержит только собственные данные товара.
 * Нет вычисляемых полей (margin, profit, stock, sales).
 * 
 * Поля:
 *   id          — уникальный идентификатор (UUID)
 *   article     — артикул продавца (WB)
 *   baseArticle — базовая модель (из артикула)
 *   category    — категория
 *   color       — цвет
 *   size        — размер
 *   barcode     — штрихкод
 *   status      — active / archived
 *   createdAt   — дата создания
 *   updatedAt   — дата последнего обновления
 *   archivedAt  — дата архивации (если архивирован)
 */
class ProductEntity {
    constructor(data) {
        this.id = data.id || this._generateId();
        this.article = data.article || '';
        this.baseArticle = data.baseArticle || this._extractBaseArticle(data.article);
        this.category = data.category || 'Товар';
        this.color = data.color || '';
        this.size = data.size || '';
        this.barcode = data.barcode || '';
        this.status = data.status || 'active';
        this.createdAt = data.createdAt || new Date().toISOString();
        this.updatedAt = new Date().toISOString();
        this.archivedAt = data.archivedAt || null;
    }

    // ============================================================
    // ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
    // ============================================================

    _generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substring(2);
    }

    _extractBaseArticle(article) {
        if (!article) return '';
        const parts = article.split('_');
        if (parts.length >= 3) {
            return parts.slice(0, -2).join('_');
        }
        return article;
    }

    // ============================================================
    // МЕТОДЫ ДЛЯ РАБОТЫ С СУЩНОСТЬЮ
    // ============================================================

    /**
     * Обновить данные товара
     */
    update(data) {
        Object.assign(this, data);
        this.updatedAt = new Date().toISOString();
        return this;
    }

    /**
     * Архивировать товар
     */
    archive() {
        if (this.status === 'archived') return;
        this.status = 'archived';
        this.archivedAt = new Date().toISOString();
        this.updatedAt = new Date().toISOString();
        return this;
    }

    /**
     * Восстановить товар из архива
     */
    restore() {
        if (this.status === 'active') return;
        this.status = 'active';
        this.archivedAt = null;
        this.updatedAt = new Date().toISOString();
        return this;
    }

    /**
     * Проверить, активен ли товар
     */
    isActive() {
        return this.status === 'active';
    }

    /**
     * Проверить, архивирован ли товар
     */
    isArchived() {
        return this.status === 'archived';
    }

    // ============================================================
    // СТАТИЧЕСКИЕ МЕТОДЫ
    // ============================================================

    /**
     * Создать новый товар из данных импорта
     */
    static createFromImport(data) {
        return new ProductEntity({
            article: data.article,
            baseArticle: data.baseArticle,
            category: data.category || 'Товар',
            color: data.color || '',
            size: data.size || '',
            barcode: data.barcode || '',
            status: 'active'
        });
    }

    /**
     * Создать новый товар вручную
     */
    static createManual(data) {
        return new ProductEntity({
            article: data.article,
            baseArticle: data.baseArticle,
            category: data.category || 'Товар',
            color: data.color || '',
            size: data.size || '',
            barcode: data.barcode || '',
            status: 'active'
        });
    }
}

// ============================================================
// ЭКСПОРТ
// ============================================================

export default ProductEntity;
