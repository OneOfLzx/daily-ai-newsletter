/**
 * Language Switcher for Daily AI Newsletter
 * Default: English
 * Supports English (en) and Chinese (zh)
 */

const translations = {
  en: {
    siteTitle: "Daily AI Newsletter",
    siteSubtitle: "Stay updated with the latest AI news and developments",
    navHome: "Home",
    navArchive: "Archive",
    navSubscribe: "Subscribe",
    langSelectLabel: "Select Language:",
    langEn: "English",
    langZh: "中文"
  },
  zh: {
    siteTitle: "每日AI简报",
    siteSubtitle: "了解最新AI资讯与动态",
    navHome: "首页",
    navArchive: "归档",
    navSubscribe: "订阅",
    langSelectLabel: "选择语言:",
    langEn: "英语",
    langZh: "中文"
  }
};

let currentLanguage = localStorage.getItem('selectedLanguage') || 'en';

/**
 * Smoothly update page content for selected language
 * @param {string} lang - Language code (en/zh)
 */
function updatePageLanguage(lang) {
  if (!translations[lang]) {
    console.warn(`Language ${lang} not supported, falling back to English`);
    lang = 'en';
  }

  document.body.style.transition = 'opacity 0.2s ease-in-out';
  document.body.style.opacity = '0.6';

  setTimeout(() => {
    document.querySelectorAll('[data-i18n]').forEach(element => {
      const key = element.getAttribute('data-i18n');
      if (translations[lang][key]) {
        element.textContent = translations[lang][key];
      }
    });

    const languageSelect = document.getElementById('language-select');
    if (languageSelect) {
      languageSelect.value = lang;
    }

    localStorage.setItem('selectedLanguage', lang);
    currentLanguage = lang;

    document.body.style.opacity = '1';
  }, 200);
}

document.addEventListener('DOMContentLoaded', () => {
  updatePageLanguage(currentLanguage);

  const languageSelect = document.getElementById('language-select');
  if (languageSelect) {
    languageSelect.addEventListener('change', (event) => {
      updatePageLanguage(event.target.value);
    });
  }
});

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { translations, updatePageLanguage, currentLanguage };
}
