// ============================================================
// UI: DATE PICKER — КАСТОМНЫЙ КАЛЕНДАРЬ
// ============================================================

export function createDatePicker(inputElement, options = {}) {
    const container = document.createElement('div');
    container.className = 'date-picker-container';
    container.style.position = 'relative';
    container.style.display = 'inline-block';
    
    // Обёртка для input
    inputElement.parentNode.insertBefore(container, inputElement);
    container.appendChild(inputElement);
    
    // Кнопка-иконка календаря
    const toggleBtn = document.createElement('button');
    toggleBtn.type = 'button';
    toggleBtn.className = 'date-picker-toggle';
    toggleBtn.innerHTML = '📅';
    toggleBtn.style.cssText = `
        position: absolute;
        right: 8px;
        top: 50%;
        transform: translateY(-50%);
        background: none;
        border: none;
        cursor: pointer;
        font-size: 16px;
        padding: 0;
        opacity: 0.6;
        transition: opacity 0.2s;
    `;
    toggleBtn.onmouseenter = () => toggleBtn.style.opacity = '1';
    toggleBtn.onmouseleave = () => toggleBtn.style.opacity = '0.6';
    container.appendChild(toggleBtn);
    
    // Календарь
    const calendar = document.createElement('div');
    calendar.className = 'date-picker-calendar';
    calendar.style.cssText = `
        position: absolute;
        top: calc(100% + 8px);
        left: 0;
        background: var(--bg-card, #FFFFFF);
        border: 1px solid var(--border, #E5E0F0);
        border-radius: var(--radius, 14px);
        box-shadow: var(--shadow-dropdown, 0 8px 24px rgba(108, 43, 217, 0.10));
        padding: 16px;
        z-index: 1000;
        display: none;
        min-width: 280px;
        font-family: var(--font, 'Inter', sans-serif);
    `;
    container.appendChild(calendar);
    
    // Состояние
    let currentDate = inputElement.value ? new Date(inputElement.value) : new Date();
    let selectedDate = inputElement.value ? new Date(inputElement.value) : null;
    
    // Функция рендеринга календаря
    function renderCalendar() {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        
        let html = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                <button type="button" class="date-picker-nav" data-dir="-1" style="background:none;border:none;cursor:pointer;font-size:16px;color:var(--text-secondary);padding:4px 8px;border-radius:var(--radius-xs);">
                    ◀
                </button>
                <span style="font-weight:600;font-size:14px;color:var(--text-primary);">
                    ${getMonthName(month)} ${year}
                </span>
                <button type="button" class="date-picker-nav" data-dir="1" style="background:none;border:none;cursor:pointer;font-size:16px;color:var(--text-secondary);padding:4px 8px;border-radius:var(--radius-xs);">
                    ▶
                </button>
            </div>
            <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;text-align:center;margin-bottom:8px;">
                ${['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(d => `
                    <span style="font-size:10px;font-weight:600;color:var(--text-muted);padding:4px 0;">${d}</span>
                `).join('')}
            </div>
            <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;">
        `;
        
        // Пустые ячейки до первого дня
        const startOffset = firstDay === 0 ? 6 : firstDay - 1;
        for (let i = 0; i < startOffset; i++) {
            html += `<div style="padding:4px;"></div>`;
        }
        
        // Дни месяца
        for (let day = 1; day <= daysInMonth; day++) {
            const dateObj = new Date(year, month, day);
            const dateStr = dateObj.toISOString().split('T')[0];
            const isToday = dateStr === todayStr;
            const isSelected = selectedDate && dateStr === selectedDate.toISOString().split('T')[0];
            const isPast = dateStr > todayStr;
            
            html += `
                <button type="button" class="date-picker-day" data-date="${dateStr}" 
                        ${isPast ? 'disabled' : ''}
                        style="
                            padding:6px 0;
                            border:none;
                            border-radius:var(--radius-sm, 8px);
                            cursor:${isPast ? 'default' : 'pointer'};
                            font-size:12px;
                            font-weight:${isToday ? '700' : '400'};
                            color:${isPast ? 'var(--text-muted)' : isSelected ? '#FFFFFF' : 'var(--text-primary)'};
                            background:${isSelected ? 'var(--gradient-primary, #7C3AED)' : isToday ? 'var(--bg-hover, #F3F0FF)' : 'transparent'};
                            opacity:${isPast ? '0.4' : '1'};
                            transition:all 0.2s;
                        "
                        onmouseenter="${!isPast ? `this.style.background='${isSelected ? 'var(--gradient-primary)' : 'var(--bg-hover)'}'` : ''}"
                        onmouseleave="${!isPast ? `this.style.background='${isSelected ? 'var(--gradient-primary)' : isToday ? 'var(--bg-hover)' : 'transparent'}'` : ''}"
                >
                    ${day}
                </button>
            `;
        }
        
        html += `</div>`;
        
        // Кнопки действий
        html += `
            <div style="display:flex;justify-content:space-between;margin-top:12px;padding-top:12px;border-top:1px solid var(--border-light, #F0ECF8);">
                <button type="button" class="date-picker-clear" style="
                    background:none;
                    border:none;
                    cursor:pointer;
                    font-size:12px;
                    color:var(--text-secondary);
                    padding:4px 12px;
                    border-radius:var(--radius-xs);
                    transition:all 0.2s;
                ">Очистить</button>
                <button type="button" class="date-picker-today" style="
                    background:var(--gradient-primary, #7C3AED);
                    border:none;
                    cursor:pointer;
                    font-size:12px;
                    color:#FFFFFF;
                    padding:4px 16px;
                    border-radius:var(--radius-sm);
                    font-weight:600;
                    transition:all 0.2s;
                ">Сегодня</button>
            </div>
        `;
        
        calendar.innerHTML = html;
        
        // Навешиваем обработчики
        calendar.querySelectorAll('.date-picker-nav').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const dir = parseInt(e.target.dataset.dir);
                currentDate.setMonth(currentDate.getMonth() + dir);
                renderCalendar();
            });
        });
        
        calendar.querySelectorAll('.date-picker-day').forEach(btn => {
            btn.addEventListener('click', () => {
                if (btn.disabled) return;
                const dateStr = btn.dataset.date;
                inputElement.value = dateStr;
                selectedDate = new Date(dateStr);
                inputElement.dispatchEvent(new Event('change'));
                calendar.style.display = 'none';
                renderCalendar();
            });
        });
        
        calendar.querySelector('.date-picker-clear')?.addEventListener('click', () => {
            inputElement.value = '';
            selectedDate = null;
            inputElement.dispatchEvent(new Event('change'));
            calendar.style.display = 'none';
            renderCalendar();
        });
        
        calendar.querySelector('.date-picker-today')?.addEventListener('click', () => {
            const today = new Date();
            const todayStr = today.toISOString().split('T')[0];
            inputElement.value = todayStr;
            selectedDate = today;
            currentDate = today;
            inputElement.dispatchEvent(new Event('change'));
            calendar.style.display = 'none';
            renderCalendar();
        });
    }
    
    // Открытие/закрытие календаря
    function toggleCalendar(e) {
        e.stopPropagation();
        if (calendar.style.display === 'block') {
            calendar.style.display = 'none';
        } else {
            renderCalendar();
            calendar.style.display = 'block';
        }
    }
    
    inputElement.addEventListener('click', toggleCalendar);
    toggleBtn.addEventListener('click', toggleCalendar);
    
    // Закрытие при клике вне
    document.addEventListener('click', (e) => {
        if (!container.contains(e.target)) {
            calendar.style.display = 'none';
        }
    });
    
    // Инициализация
    renderCalendar();
    
    return {
        container,
        calendar,
        renderCalendar,
        toggleCalendar
    };
}

function getMonthName(month) {
    const names = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 
                   'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
    return names[month];
}

export default createDatePicker;
