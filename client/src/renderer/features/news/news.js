/**
 * Ganj4Craft Launcher - News Feature
 * Загрузка и отображение новостей
 */

import { dom } from '../../utils/dom.js';

/**
 * Загрузить новости
 */
export async function loadNews() {
    const list = dom.get('news-list');
    if (!list || !window.api?.getNews) return;

    try {
        const result = await window.api.getNews();
        list.replaceChildren();
        if (!result.success || !Array.isArray(result.news) || result.news.length === 0) {
            list.innerHTML = '<div class="dashboard-news-placeholder">Новостей пока нет.</div>';
            return;
        }

        result.news.forEach(item => {
            const card = document.createElement('article');
            card.className = 'news-item';
            const date = item.timestamp ? new Date(item.timestamp * 1000) : null;
            const dateText = date && !Number.isNaN(date.getTime())
                ? date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
                : (item.created_at || '');
            const dateNode = document.createElement('div');
            dateNode.className = 'news-date';
            dateNode.textContent = dateText;
            card.appendChild(dateNode);
            if (item.image_url) {
                const image = document.createElement('img');
                image.src = item.image_url;
                image.alt = '';
                image.loading = 'lazy';
                card.appendChild(image);
            }
            const text = document.createElement('div');
            text.className = 'news-text';
            text.textContent = item.text || '';
            card.appendChild(text);
            list.appendChild(card);
        });
    } catch (error) {
        console.error('[NEWS] Failed to load news:', error);
        list.innerHTML = '<div class="dashboard-news-placeholder is-error">Не удалось загрузить новости.</div>';
    }
}
