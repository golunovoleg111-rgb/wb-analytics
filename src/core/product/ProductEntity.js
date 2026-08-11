// ============================================================
// PRODUCT ENTITY — ИЗДЕЛИЕ / ВАРИАНТ
// ============================================================

function clean(value) {
    return String(value ?? '').trim();
}

function normalize(value) {
    return clean(value).toLowerCase().replace(/\\s+/g, ' ');
}

function extractProductGroupKey(article) {
    const value = clean(article);
    const match = value.match(/^(\\d{2,3})(?:_|$)/);
    return match ? match[1] : normalize(value);
}

function extractSize(article, suppliedSize = '') {
    if (clean(suppliedSize)) return clean(suppliedSize);
    const parts = clean(article).split('_').filter(Boolean);
    const last = parts.at(-1) || '';
    return /^(XXS|XS|S|M|L|XL|XXL|XXXL|[0-9]{2,3})$/i.test(last) ? last : '';
}

function extractColor(article, suppliedColor = '', size = '') {
    if (clean(suppliedColor)) return clean(suppliedColor);
    const parts = clean(article).split('_').filter(Boolean);
    if (size && parts.at(-1)?.toLowerCase() === size.toLowerCase()) parts.pop();
    // Цвет обычно является последним текстовым сегментом после модели.
    return parts.length >= 2 ? parts.at(-1) : '';
}

class ProductEntity {
    constructor(data = {}) {
        this.article = clean(data.article);
        this.size = extractSize(this.article, data.size);
        this.color = extractColor(this.article, data.color, this.size);
        this.productGroupKey = clean(data.productGroupKey) || extractProductGroupKey(this.article);
        this.baseModel = clean(data.baseArticle || data.baseModel) || this.productGroupKey;
        this.articleKey = clean(data.articleKey) || this._generateArticleKey(this.article, this.size, this.color, data.barcode);
        this.id = clean(data.id) || this.articleKey;
        this.category = clean(data.category) || 'Товар';
        this.barcode = clean(data.barcode);
        this.tnved = clean(data.tnved);
        this.gtin = clean(data.gtin);
        this.fabric = clean(data.fabric);
        this.name = clean(data.name) || clean(data.workName) || clean(data.productName) || this.baseModel || this.article;
        this.price = Number(data.price) || 0;
        this.purchasePrice = Number(data.purchasePrice) || 0;
        this.status = data.status === 'archived' ? 'archived' : 'active';
        this.createdAt = data.createdAt || new Date().toISOString();
        this.updatedAt = new Date().toISOString();
        this.archivedAt = data.archivedAt || null;
    }

    _generateArticleKey(article, size, color, barcode) {
        const a = normalize(article);
        const b = clean(barcode);
        if (b) return `${a}|${b}`;
        return `${a}|${normalize(size) || 'nosize'}|${normalize(color) || 'nocolor'}`;
    }

    update(data = {}) {
        Object.assign(this, data);
        if (data.article || data.size || data.color || data.barcode) {
            this.size = extractSize(this.article, this.size);
            this.color = extractColor(this.article, this.color, this.size);
            this.productGroupKey = clean(this.productGroupKey) || extractProductGroupKey(this.article);
            this.articleKey = this._generateArticleKey(this.article, this.size, this.color, this.barcode);
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

    isActive() { return this.status === 'active'; }
    isArchived() { return this.status === 'archived'; }

    static createFromImport(data) { return new ProductEntity({ ...data, status: 'active' }); }
    static createManual(data) { return new ProductEntity({ ...data, status: 'active' }); }
}

export default ProductEntity;
