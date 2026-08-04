// ============================================================
// PRODUCT ENTITY — СУЩНОСТЬ ТОВАРА
// ============================================================

class ProductEntity {
    constructor(data) {
        this.id = data.id || this._generateId();
        this.article = data.article || '';
        this.articleKey = data.articleKey || this._generateArticleKey(data.article, data.size, data.color);
        this.baseModel = data.baseArticle || data.baseModel || this._extractBaseArticle(data.article);
        this.category = data.category || 'Товар';
        this.color = data.color || '';
        this.size = data.size || '';
        this.barcode = data.barcode || '';
        this.tnved = data.tnved || '';
        this.gtin = data.gtin || '';
        this.fabric = data.fabric || '';
        this.name = data.name || '';
        this.price = data.price || 0;
        this.purchasePrice = data.purchasePrice || 0;
        this.status = data.status || 'active';
        this.createdAt = data.createdAt || new Date().toISOString();
        this.updatedAt = new Date().toISOString();
        this.archivedAt = data.archivedAt || null;
    }

    // ============================================================
    // ГЕНЕРАТОРЫ ID
    // ============================================================

    _generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substring(2);
    }

    _generateArticleKey(article, size, color) {
        const s = size || 'NOSIZE';
        const c = color || 'NOCOLOR';
        return `${article}_${s}_${c}`;
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

    update(data) {
        Object.assign(this, data);
        this.updatedAt = new Date().toISOString();
        if (data.article || data.size || data.color) {
            this.articleKey = this._generateArticleKey(
                data.article || this.article,
                data.size || this.size,
                data.color || this.color
            );
        }
        return this;
    }

    archive() {
        if (this.status === 'archived') return this;
        this.status = 'archived';
        this.archivedAt = new Date().toISOString();
        this.updatedAt = new Date().toISOString();
        return this;
    }

    restore() {
        if (this.status === 'active') return this;
        this.status = 'active';
        this.archivedAt = null;
        this.updatedAt = new Date().toISOString();
        return this;
    }

    isActive() {
        return this.status === 'active';
    }

    isArchived() {
        return this.status === 'archived';
    }

    // ============================================================
    // СТАТИЧЕСКИЕ МЕТОДЫ — СОЗДАНИЕ
    // ============================================================

    static createFromImport(data) {
        return new ProductEntity({
            article: data.article,
            articleKey: data.articleKey,
            baseArticle: data.baseModel || data.baseArticle,
            category: data.category || 'Товар',
            color: data.color || '',
            size: data.size || '',
            barcode: data.barcode || '',
            tnved: data.tnved || '',
            gtin: data.gtin || '',
            fabric: data.fabric || '',
            name: data.name || data.baseModel || data.article,
            price: data.price || 0,
            purchasePrice: data.purchasePrice || 0,
            status: 'active'
        });
    }

    static createManual(data) {
        return new ProductEntity({
            article: data.article,
            articleKey: data.articleKey,
            baseArticle: data.baseArticle,
            category: data.category || 'Товар',
            color: data.color || '',
            size: data.size || '',
            barcode: data.barcode || '',
            tnved: data.tnved || '',
            gtin: data.gtin || '',
            fabric: data.fabric || '',
            name: data.name || data.article,
            price: data.price || 0,
            purchasePrice: data.purchasePrice || 0,
            status: 'active'
        });
    }
}

export default ProductEntity;
