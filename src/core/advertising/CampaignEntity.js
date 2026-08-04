// ============================================================
// CAMPAIGN ENTITY — СУЩНОСТЬ РЕКЛАМНОЙ КАМПАНИИ
// ============================================================

class CampaignEntity {
    constructor(data) {
        this.id = data.id || this._generateId();
        this.campaignId = data.campaignId || '';
        this.name = data.name || '';
        this.type = data.type || 'Аукцион';
        this.status = data.status || 'active'; // active | paused | archived
        this.budget = data.budget || 0;
        this.dailyLimit = data.dailyLimit || 0;
        this.cpc = data.cpc || 0;
        this.linkedArticle = data.linkedArticle || null;
        this.createdAt = data.createdAt || new Date().toISOString();
        this.updatedAt = new Date().toISOString();
        this.archivedAt = data.archivedAt || null;
    }

    _generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substring(2);
    }

    // ============================================================
    // УПРАВЛЕНИЕ СТАТУСОМ
    // ============================================================

    pause() {
        if (this.status === 'paused') return this;
        this.status = 'paused';
        this.updatedAt = new Date().toISOString();
        return this;
    }

    resume() {
        if (this.status === 'active') return this;
        this.status = 'active';
        this.updatedAt = new Date().toISOString();
        return this;
    }

    archive() {
        if (this.status === 'archived') return this;
        this.status = 'archived';
        this.archivedAt = new Date().toISOString();
        this.updatedAt = new Date().toISOString();
        return this;
    }

    isActive() {
        return this.status === 'active';
    }

    isPaused() {
        return this.status === 'paused';
    }

    isArchived() {
        return this.status === 'archived';
    }

    // ============================================================
    // ОБНОВЛЕНИЕ НАСТРОЕК
    // ============================================================

    updateSettings(data) {
        if (data.budget !== undefined) this.budget = data.budget;
        if (data.dailyLimit !== undefined) this.dailyLimit = data.dailyLimit;
        if (data.cpc !== undefined) this.cpc = data.cpc;
        this.updatedAt = new Date().toISOString();
        return this;
    }

    linkProduct(article) {
        this.linkedArticle = article;
        this.updatedAt = new Date().toISOString();
        return this;
    }

    // ============================================================
    // СТАТИЧЕСКИЕ МЕТОДЫ
    // ============================================================

    static createFromImport(data) {
        return new CampaignEntity({
            campaignId: data.wbId || data.campaignId,
            name: data.campaign || data.name,
            type: data.type || 'Аукцион',
            status: 'active',
            budget: data.budget || 0,
            dailyLimit: data.dailyLimit || 0,
            cpc: data.cpc || 0
        });
    }

    static createManual(data) {
        return new CampaignEntity({
            campaignId: 'manual_' + Date.now(),
            name: data.name,
            type: data.type || 'Аукцион',
            status: data.status || 'active',
            budget: data.budget || 0,
            dailyLimit: data.dailyLimit || 0,
            cpc: data.cpc || 0,
            linkedArticle: data.linkedArticle || null
        });
    }
}

export default CampaignEntity;
