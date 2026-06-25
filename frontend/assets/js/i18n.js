const TRADUCOES = {
  pt: {
    'nav.inicio': 'Início',
    'nav.visaoGeral': 'Visão geral',
    'nav.analises': 'Análises',
    'nav.leads': 'Leads',
    'nav.agenda': 'Agenda',
    'nav.catalogo': 'Catálogo',
    'nav.configuracoes': 'Configurações',
    'nav.suporte': 'Suporte',
    'nav.adminSaas': 'Admin do SaaS',
    'nav.minhaConta': 'Minha conta (cliente)',
    'nav.sair': 'Sair',
    'nav.produtos': 'Produtos',
    'nav.clientes': 'Clientes',
    'nav.afiliados': 'Afiliados',
    'nav.conversoes': 'Conversões',
    'config.titulo': 'Configurações',
    'config.subtitulo': 'Gerencie sua conta, idioma e tema do site.',
    'config.tabPerfil': 'Perfil/Usuário',
    'config.tabIdioma': 'Idioma',
    'config.tabTema': 'Tema',
    'config.idiomaTitulo': 'Idioma do site',
    'config.idiomaDesc': 'Escolha o idioma usado na navegação e nas telas de configuração.',
    'config.temaTitulo': 'Tema do site',
    'config.temaDesc': 'Escolha entre tema claro, escuro, ou seguir o sistema do seu dispositivo.',
    'config.temaClaro': 'Claro',
    'config.temaEscuro': 'Escuro',
    'config.temaSistema': 'Sistema',
  },
  en: {
    'nav.inicio': 'Home',
    'nav.visaoGeral': 'Overview',
    'nav.analises': 'Analytics',
    'nav.leads': 'Leads',
    'nav.agenda': 'Schedule',
    'nav.catalogo': 'Catalog',
    'nav.configuracoes': 'Settings',
    'nav.suporte': 'Support',
    'nav.adminSaas': 'SaaS Admin',
    'nav.minhaConta': 'My account (customer)',
    'nav.sair': 'Log out',
    'nav.produtos': 'Products',
    'nav.clientes': 'Customers',
    'nav.afiliados': 'Affiliates',
    'nav.conversoes': 'Conversions',
    'config.titulo': 'Settings',
    'config.subtitulo': 'Manage your account, language and site theme.',
    'config.tabPerfil': 'Profile/User',
    'config.tabIdioma': 'Language',
    'config.tabTema': 'Theme',
    'config.idiomaTitulo': 'Site language',
    'config.idiomaDesc': 'Choose the language used across navigation and settings screens.',
    'config.temaTitulo': 'Site theme',
    'config.temaDesc': 'Choose between light, dark, or following your device settings.',
    'config.temaClaro': 'Light',
    'config.temaEscuro': 'Dark',
    'config.temaSistema': 'System',
  },
  es: {
    'nav.inicio': 'Inicio',
    'nav.visaoGeral': 'Resumen',
    'nav.analises': 'Análisis',
    'nav.leads': 'Leads',
    'nav.agenda': 'Agenda',
    'nav.catalogo': 'Catálogo',
    'nav.configuracoes': 'Configuración',
    'nav.suporte': 'Soporte',
    'nav.adminSaas': 'Admin del SaaS',
    'nav.minhaConta': 'Mi cuenta (cliente)',
    'nav.sair': 'Cerrar sesión',
    'nav.produtos': 'Productos',
    'nav.clientes': 'Clientes',
    'nav.afiliados': 'Afiliados',
    'nav.conversoes': 'Conversiones',
    'config.titulo': 'Configuración',
    'config.subtitulo': 'Gestiona tu cuenta, idioma y el tema del sitio.',
    'config.tabPerfil': 'Perfil/Usuario',
    'config.tabIdioma': 'Idioma',
    'config.tabTema': 'Tema',
    'config.idiomaTitulo': 'Idioma del sitio',
    'config.idiomaDesc': 'Elige el idioma usado en la navegación y en las pantallas de configuración.',
    'config.temaTitulo': 'Tema del sitio',
    'config.temaDesc': 'Elige entre tema claro, oscuro, o seguir el sistema de tu dispositivo.',
    'config.temaClaro': 'Claro',
    'config.temaEscuro': 'Oscuro',
    'config.temaSistema': 'Sistema',
  },
};

const Lang = {
  IDIOMAS: ['pt', 'en', 'es'],

  get() {
    const salvo = localStorage.getItem('idioma');
    return this.IDIOMAS.includes(salvo) ? salvo : 'pt';
  },

  set(idioma) {
    localStorage.setItem('idioma', idioma);
    this.aplicar();
  },

  t(chave) {
    return TRADUCOES[this.get()]?.[chave] || TRADUCOES.pt[chave] || chave;
  },

  aplicar() {
    document.documentElement.lang = this.get() === 'pt' ? 'pt-BR' : this.get();

    document.querySelectorAll('[data-i18n]').forEach((el) => {
      el.textContent = this.t(el.dataset.i18n);
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      el.placeholder = this.t(el.dataset.i18nPlaceholder);
    });
  },
};
