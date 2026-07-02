import { createApp } from 'vue';
import ElementPlus from 'element-plus';
import zhCn from 'element-plus/es/locale/lang/zh-cn';
import 'element-plus/dist/index.css';
import App from './App.vue';
import router from './router';
import { useAuthStore } from './stores/auth.store';
import { pinia } from './stores/pinia';
import './styles/element-plus-theme.css';
import './styles/main.css';
import { AUTH_EXPIRED_EVENT } from './services/http-client';

const app = createApp(App);
app.use(pinia);
app.use(router);
app.use(ElementPlus, { locale: zhCn });
app.mount('#app');

window.addEventListener(AUTH_EXPIRED_EVENT, async () => {
  const authStore = useAuthStore(pinia);
  authStore.clearSession();
  if (router.currentRoute.value.name !== 'login') {
    await router.push({
      name: 'login',
      query: {
        reason: 'expired',
        redirect: router.currentRoute.value.fullPath,
      },
    });
  }
});
