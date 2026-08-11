// ============================================================
// PRODUCT ENTITY — ИЗДЕЛИЕ / ВАРИАНТ
// ============================================================

import { parseProductArticle, makeVariantKey } from './ProductParser.js';

function clean(value) { return String(value ?? '').trim(); }
function normalize(value) { return clean(value).toLowerCase().replace(/\s+/g, ' '); }

class ProductEntity {
    constructor(data = {}) {
        this.article = clean(data.article);
        const parsed = parseProductArticle(this.article, { size: data.size, color: data.color });
        this.originalArticle = parsed.originalArticle;
        this.size = parsed.size;
        this.color = parsed.color;
        this.productGroupKey = clean(data.productGroupKey) || parsed.productGroupKey;
        this.baseModel = clean(data.baseArticle || data.baseModel) || this.productGroupKey;
        this.articleKey = clean(data.articleKey) || makeVariantKey(parsed, data.barcode);
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

    update(data = {}) {
        Object.assign(this, data);
        if (data.article || data.size || data.color || data.barcode) {
            const parsed = parseProductArticle(this.article, { size: data.size || this.size, color: data.color || this.color });
            this.originalArticle = parsed.originalArticle;
            this.size = parsed.size;
            this.color = parsed.color;
            this.productGroupKey = clean(data.productGroupKey) || parsed.productGroupKey;
            this.articleKey = makeVariantKey(parsed, this.barcode);
            this.id = this.articleKey;
        }
        this.updatedAt = new Date().toISOString();
        return this;
    }

    archive() { this.status = 'archived'; this.archivedAt = new Date().toISOString(); this.updatedAt = new Date().toISOString(); return this; }
    restore() { this.status = 'active'; this.archivedAt = null; this.updatedAt = new Date().toISOString(); return this; }
    isActive() { return this.status === 'active'; }
    isArchived() { return this.status === 'archived'; }
    static createFromImport(data) { return new ProductEntity({ ...data, status: 'active' }); }
    static createManual(data) { return new ProductEntity({ ...data, status: 'active' }); }
}

export default ProductEntity;
