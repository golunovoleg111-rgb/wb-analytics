// ============================================================
// CAMPAIGN AGGREGATE — УПРАВЛЕНИЕ РЕКЛАМНЫМИ КАМПАНИЯМИ
// ============================================================

import CampaignEntity from './CampaignEntity.js';
import { Database } from '../../infrastructure/db.js';

class CampaignAggregate {
    
    // ============================================================
    // СОЗДАНИЕ
    // ============================================================

    static async create(data) {
        const campaign = CampaignEntity.createFromImport(data);
        await Database.save(Database.STORES.ADVERTISING, campaign);
        return campaign;
    }

    static async createManual(data) {
        const campaign = CampaignEntity.createManual(data);
        await Database.save(Database.STORES.ADVERTISING, campaign);
        return campaign;
    }

    static async createMany(items) {
        const results = [];
        const errors = [];
        for (const item of items) {
            try {
                const campaign = await this.create(item);
                results.push(campaign);
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
        const data = await Database.getById(Database.STORES.ADVERTISING, id);
        if (!data) return null;
        return new CampaignEntity(data);
    }

    static async getAll() {
        const all = await Database.getAll(Database.STORES.ADVERTISING);
        return all.map(d => new CampaignEntity(d));
    }

    static async getActive() {
        const all = await this.getAll();
        return all.filter(c => c.isActive());
    }

    static async getByStatus(status) {
        const all = await this.getAll();
        return all.filter(c => c.status === status);
    }

    static async getByProduct(article) {
        const all = await this.getAll();
        return all.filter(c => c.linkedArticle === article);
    }

    // ============================================================
    // ОБНОВЛЕНИЕ
    // ============================================================

    static async update(id, data) {
        const campaign = await this.getById(id);
        if (!campaign) {
            throw new Error(`Кампания ${id} не найдена`);
        }
        campaign.updateSettings(data);
        await Database.save(Database.STORES.ADVERTISING, campaign);
        return campaign;
    }

    static async linkProduct(id, article) {
        const campaign = await this.getById(id);
        if (!campaign) {
            throw new Error(`Кампания ${id} не найдена`);
        }
        campaign.linkProduct(article);
        await Database.save(Database.STORES.ADVERTISING, campaign);
        return campaign;
    }

    static async pause(id) {
        const campaign = await this.getById(id);
        if (!campaign) {
            throw new Error(`Кампания ${id} не найдена`);
        }
        campaign.pause();
        await Database.save(Database.STORES.ADVERTISING, campaign);
        return campaign;
    }

    static async resume(id) {
        const campaign = await this.getById(id);
        if (!campaign) {
            throw new Error(`Кампания ${id} не найдена`);
        }
        campaign.resume();
        await Database.save(Database.STORES.ADVERTISING, campaign);
        return campaign;
    }

    static async archive(id) {
        const campaign = await this.getById(id);
        if (!campaign) {
            throw new Error(`Кампания ${id} не найдена`);
        }
        campaign.archive();
        await Database.save(Database.STORES.ADVERTISING, campaign);
        return campaign;
    }

    // ============================================================
    // УДАЛЕНИЕ
    // ============================================================

    static async delete(id) {
        await Database.delete(Database.STORES.ADVERTISING, id);
    }

    static async clearAll() {
        await Database.clear(Database.STORES.ADVERTISING);
    }
}

export default CampaignAggregate;
