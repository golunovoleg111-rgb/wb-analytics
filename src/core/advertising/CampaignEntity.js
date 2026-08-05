// ============================================================
// CAMPAIGN ENTITY — СУЩНОСТЬ РЕКЛАМНОЙ КАМПАНИИ
// ============================================================

class CampaignEntity {
    constructor(data) {
        this.id = data.id || this._generateId();
        this.campaignId = data.campaignId || '';
        this.name = data.name || data.campaign || '';
        this.campaign = data.campaign || data.name || '';
        this.type = data.type || 'Аукцион';
        this.status = data.status || 'active'; // active | paused | archived
        this.budget = data.budget || 0;
        this.dailyLimit = data.dailyLimit || 0;
        this.cpc = data.cpc || 0;
        this.linkedArticle = data.linkedArticle || null;
        
        // Поля из импорта ADS
        this.startDate = data.startDate || null;
        this.finishDate = data.finishDate || null;
        this.impressions = data.impressions || 0;
        this.frequency = data.frequency || 0;
        this.clicks = data.clicks || 0;
        this.cpm = data.cpm || 0;
        this.ctr = data.ctr || 0;
        this.duration = data.duration || '';
        this.cr = data.cr || 0;
        this.spent = data.spent || 0;
        this.orders = data.orders || 0;
        this.cartAdds = data.cartAdds || 0;
        
        this.createdAt = data.createdAt || new Date().toISOString();
        this.updatedAt = new Date().toISOString();
        this.archivedAt = data.archivedAt || null;
        
        // Для обратной совместимости
        this.stats = data.stats || {};
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
    // ПРИВЯЗКА ТОВАРА
    // ============================================================

    linkProduct(article) {
        this.linkedArticle = article || null;
        this.updatedAt = new Date().toISOString();
        return this;
    }

    // ============================================================
    // ОБНОВЛЕНИЕ НАСТРОЕК
    // ============================================================

    updateSettings(data) {
        if (data.budget !== undefined) this.budget = data.budget;
        if (data.dailyLimit !== undefined) this.dailyLimit = data.dailyLimit;
        if (data.cpc !== undefined) this.cpc = data.cpc;
        if (data.name !== undefined) {
            this.name = data.name;
            this.campaign = data.name;
        }
        this.updatedAt = new Date().toISOString();
        return this;
    }

    // ============================================================
    // СТАТИЧЕСКИЕ МЕТОДЫ
    // ============================================================

    static createFromImport(data) {
        return new CampaignEntity({
            campaignId: data.wbId || data.campaignId || data.id,
            campaign: data.campaign || data.name,
            name: data.campaign || data.name,
            type: data.type || 'Аукцион',
            status: data.status || 'active',
            budget: data.budget || 0,
            dailyLimit: data.dailyLimit || 0,
            cpc: data.cpc || 0,
            // Поля из импорта ADS
            startDate: data.startDate || null,
            finishDate: data.finishDate || null,
            impressions: data.impressions || 0,
            frequency: data.frequency || 0,
            clicks: data.clicks || 0,
            cpm: data.cpm || 0,
            ctr: data.ctr || 0,
            duration: data.duration || '',
            cr: data.cr || 0,
            spent: data.spent || 0,
            orders: data.orders || 0,
            cartAdds: data.cartAdds || 0,
            linkedArticle: data.linkedArticle || null
        });
    }

    static createManual(data) {
        return new CampaignEntity({
            campaignId: 'manual_' + Date.now(),
            campaign: data.name,
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
