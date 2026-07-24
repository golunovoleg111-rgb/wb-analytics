// Навигация между страницами
function navigateTo(pageName) {
    // Убираем active со всех пунктов меню
    document.querySelectorAll('.menu-item').forEach(function(item) {
        item.classList.remove('active');
    });

    // Ставим active на выбранный пункт
    var menuItem = document.querySelector('.menu-item[data-page="' + pageName + '"]');
    if (menuItem) {
        menuItem.classList.add('active');
    }

    // Скрываем все страницы
    document.querySelectorAll('.page').forEach(function(page) {
        page.classList.remove('active');
    });

    // Показываем выбранную страницу
    var page = document.getElementById('page-' + pageName);
    if (page) {
        page.classList.add('active');
    }
}

// Вешаем обработчики после загрузки страницы
document.addEventListener('DOMContentLoaded', function() {
    // Навигация по клику на пункты меню
    document.querySelectorAll('.menu-item').forEach(function(item) {
        item.addEventListener('click', function() {
            var page = this.getAttribute('data-page');
            navigateTo(page);
        });
    });

    // Клик на логотип — переход на Главную
    document.getElementById('sidebarLogo').addEventListener('click', function() {
        navigateTo('dashboard');
    });
});
