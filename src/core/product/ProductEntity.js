// ============================================================
// PRODUCT ENTITY — ДАННЫЕ ТОВАРА
// ============================================================

function clean(value) {
    return String(value ?? '').trim();
}

class ProductEntity {
    constructor(data = {}) {
        this.article = clean(data.article);
        this.size = clean(data.size);
        this.color = clean(data.color);
        this.articleKey = clean(data.articleKey) || this._generateArticleKey(this.article, this.size, this.color);
        this.id = clean(data.id) || this.articleKey;
        this.baseModel = clean(data.baseArticle || data.baseModel) || this._extractBaseArticle(this.article);
        this.category = clean(data.category) || 'Товар';
        this.barcode = clean(data.barcode);
        this.tnved = clean(data.tnved);
        this.gtin = clean(data.gtin);
        this.fabric = clean(data.fabric);
        this.name = clean(data.name) || this.baseModel || this.article;
        this.price = Number(data.price) || 0;
        this.purchasePrice = Number(data.purchasePrice) || 0;
        this.status = data.status === 'archived' ? 'archived' : 'active';
        this.createdAt = data.createdAt || new Date().toISOString();
        this.updatedAt = new Date().toISOString();
        this.archivedAt = data.archivedAt || null;
    }

    _generateArticleKey(article, size, color) {
        const a = clean(article);
        const s = clean(size) || 'NOSIZE';
        const c = clean(color) || 'NOCOLOR';
        return `${a}|${s}|${c}`;
    }

    _extractBaseArticle(article) {
        const value = clean(article);
        if (!value) return '';

        const parts = value.split('_').filter(Boolean);
        if (parts.length < 2) return value;

        // Для WB чаще всего размер и цвет идут последними сегментами.
        // Если последний сегмент похож на размер — убираем его;
        // цвет убираем только если он очевидно отделён.
        const sizePattern = /^(\d{2,3}|XXS|XS|S|M|L|XL|XXL|XXXL)$/i;
        const last = parts[parts.length - 1];
        if (sizePattern.test(last) && parts.length >= 2) {
            return parts.slice(0, -1).join('_');
        }

        return parts.slice(0, -1).join('_');
    }

    update(data = {}) {
        Object.assign(this, data);
        if (data.article || data.size || data.color) {
            this.articleKey = this._generateArticleKey(this.article, this.size, this.color);
            this.id = this.articleKey;
        }
        this.updatedAt = new Date().toISOString();
        return this;
    }

    archive() {
        this.status = 'archived';
        this.archivedAt = new Date().toISOString();
        this.updatedAt = new Date().toISOString();
        return this;
    }

    restore() {
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

    static createFromImport(data) {
        return new ProductEntity({ ...data, status: 'active' });
    }

    static createManual(data) {
        return new ProductEntity({ ...data, status: 'active' });
    }
}

export default ProductEntity;
