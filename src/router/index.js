import { createRouter, createWebHashHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'shelf',
    component: () => import('@/components/Bookshelf.vue'),
  },
  {
    path: '/reader',
    name: 'reader',
    component: () => import('@/components/Reader.vue'),
    props: (route) => ({
      book: route.query.book ? JSON.parse(route.query.book) : null
    }),
  },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

export default router
