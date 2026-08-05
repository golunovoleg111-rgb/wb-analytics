// ============================================================
// UI: DATE PICKER — КАСТОМНЫЙ КАЛЕНДАРЬ
// ============================================================

let activeCalendar = null; // Храним ссылку на открытый календарь

export function createDatePicker(inputElement, options = {}) {
    // Если уже есть контейнер — удаляем старый
    const existingContainer = inputElement.parentElement?.closest?.('.date-picker-container');
    if (existingContainer) {
        existingContainer.remove();
    }

    const container = document.createElement('div');
    container.className = 'date-picker-container';
    container.style.cssText = `
        position: relative;
        display: inline-block;
        width: 100%;
    `;
    
    // Обёртка для input
    inputElement.parentNode.insertBefore(container, inputElement);
    container.appendChild(inputElement);

    // Меняем стиль input
    inputElement.style.cssText = `
        padding: 6px 36px 6px 10px;
        border: 1.5px solid var(--border, #E5E0F0);
        border-radius: var(--radius-sm, 8px);
        font-size: 12px;
        background: var(--bg-input, #FAF8FF);
        color: var(--text-primary, #1A1A2E);
        cursor: pointer;
        min-width: 140px;
        width: 100%;
        outline: none;
        transition: all 0.2s;
    `;
    
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
        padding: 4px;
        opacity: 0.6;
        transition: opacity 0.2s;
        z-index: 2;
    `;
    toggleBtn.onmouseenter = () => toggleBtn.style.opacity = '1';
    toggleBtn.onmouseleave = () => toggleBtn.style.opacity = '0.6';
    container.appendChild(toggleBtn);
    
    // Календарь
    const calendar = document.createElement('div');
    calendar.className = 'date-picker-calendar';
    calendar.style.cssText = `
        position: absolute;
        top: calc(100% + 4px);
        left: 0;
        background: var(--bg-card, #FFFFFF);
        border: 1px solid var(--border, #E5E0F0);
        border-radius: var(--radius, 14px);
        box-shadow: 0 8px 32px rgba(0,0,0,0.12);
        padding: 16px;
        z-index: 9999;
        display: none;
        min-width: 260px;
        font-family: var(--font, 'Inter', sans-serif);
        max-width: 300px;
    `;
    container.appendChild(calendar);
    
    // Состояние
    let currentDate = inputElement.value ? new Date(inputElement.value) : new Date();
    let selectedDate = inputElement.value ? new Date(inputElement.value) : null;
    let isOpen = false;

    // Функция рендеринга календаря
    function renderCalendar() {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        
        // Определяем макс дату (сегодня)
        const maxDateStr = todayStr;
        
        let html = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                <button type="button" class="date-picker-nav" data-dir="-1" style="background:none;border:none;cursor:pointer;font-size:16px;color:var(--text-secondary);padding:4px 8px;border-radius:var(--radius-xs);transition:all 0.2s;">
                    ◀
                </button>
                <span style="font-weight:600;font-size:14px;color:var(--text-primary);">
                    ${getMonthName(month)} ${year}
                </span>
                <button type="button" class="date-picker-nav" data-dir="1" style="background:none;border:none;cursor:pointer;font-size:16px;color:var(--text-secondary);padding:4px 8px;border-radius:var(--radius-xs);transition:all 0.2s;">
                    ▶
                </button>
            </div>
            <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;text-align:center;margin-bottom:6px;">
                ${['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(d => `
                    <span style="font-size:10px;font-weight:600;color:var(--text-muted);padding:4px 0;">${d}</span>
                `).join('')}
            </div>
            <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;">
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
            const isPast = dateStr > maxDateStr;
            
            // Определяем стиль в зависимости от состояния
            let bgColor = 'transparent';
            let textColor = 'var(--text-primary)';
            let fontWeight = '400';
            let cursor = 'pointer';
            
            if (isSelected) {
                bgColor = 'var(--gradient-primary, #7C3AED)';
                textColor = '#FFFFFF';
                fontWeight = '600';
            } else if (isToday) {
                bgColor = 'var(--bg-hover, #F3F0FF)';
                fontWeight = '700';
            }
            
            if (isPast) {
                textColor = 'var(--text-muted)';
                cursor = 'default';
            }
            
            html += `
                <button type="button" class="date-picker-day" data-date="${dateStr}" 
                        data-disabled="${isPast}"
                        style="
                            padding:6px 0;
                            border:none;
                            border-radius:var(--radius-sm, 8px);
                            cursor:${cursor};
                            font-size:12px;
                            font-weight:${fontWeight};
                            color:${textColor};
                            background:${bgColor};
                            transition:all 0.15s;
                            ${isPast ? 'opacity:0.4;' : ''}
                        "
                        ${isPast ? 'disabled' : ''}
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
        
        // Навешиваем обработчики (используем делегирование)
        calendar.querySelectorAll('.date-picker-nav').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const dir = parseInt(e.target.dataset.dir);
                currentDate.setMonth(currentDate.getMonth() + dir);
                renderCalendar();
            });
        });
        
        calendar.querySelectorAll('.date-picker-day:not([disabled])').forEach(btn => {
            btn.addEventListener('click', () => {
                const dateStr = btn.dataset.date;
                inputElement.value = dateStr;
                selectedDate = new Date(dateStr);
                inputElement.dispatchEvent(new Event('change'));
                closeCalendar();
            });
        });
        
        calendar.querySelector('.date-picker-clear')?.addEventListener('click', (e) => {
            e.stopPropagation();
            inputElement.value = '';
            selectedDate = null;
            inputElement.dispatchEvent(new Event('change'));
            closeCalendar();
        });
        
        calendar.querySelector('.date-picker-today')?.addEventListener('click', (e) => {
            e.stopPropagation();
            const today = new Date();
            const todayStr = today.toISOString().split('T')[0];
            inputElement.value = todayStr;
            selectedDate = today;
            currentDate = today;
            inputElement.dispatchEvent(new Event('change'));
            closeCalendar();
        });
    }
    
    // Открытие календаря
    function openCalendar() {
        // Закрываем все другие календари
        if (activeCalendar && activeCalendar !== calendar) {
            activeCalendar.style.display = 'none';
        }
        
        // Обновляем текущую дату из input
        if (inputElement.value) {
            const val = new Date(inputElement.value);
            if (!isNaN(val.getTime())) {
                currentDate = val;
                selectedDate = val;
            }
        }
        
        renderCalendar();
        calendar.style.display = 'block';
        isOpen = true;
        activeCalendar = calendar;
    }
    
    // Закрытие календаря
    function closeCalendar() {
        calendar.style.display = 'none';
        isOpen = false;
        if (activeCalendar === calendar) {
            activeCalendar = null;
        }
    }
    
    // Переключение
    function toggleCalendar(e) {
        e.stopPropagation();
        if (isOpen) {
            closeCalendar();
        } else {
            openCalendar();
        }
    }
    
    // Обработчики
    inputElement.addEventListener('click', toggleCalendar);
    toggleBtn.addEventListener('click', toggleCalendar);
    
    // Закрытие при клике вне
    document.addEventListener('click', (e) => {
        if (!container.contains(e.target)) {
            closeCalendar();
        }
    });
    
    // Закрытие при нажатии Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && isOpen) {
            closeCalendar();
        }
    });
    
    // Инициализация
    renderCalendar();
    
    return {
        container,
        calendar,
        open: openCalendar,
        close: closeCalendar,
        toggle: toggleCalendar,
        render: renderCalendar
    };
}

function getMonthName(month) {
    const names = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 
                   'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
    return names[month];
}

export default createDatePicker;
