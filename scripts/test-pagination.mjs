import {
  computePageCount, ratioToPageIndex, pageIndexToRatio, clampPage,
  resolveNextPage, resolvePrevPage,
} from '../src/modules/reader/pagination.js'

let pass = 0, fail = 0
const eq = (got, exp, msg) => {
  const ok = JSON.stringify(got) === JSON.stringify(exp)
  console.log((ok ? 'PASS' : 'FAIL ❌') + ' ' + msg + (ok ? '' : ` got=${JSON.stringify(got)} exp=${JSON.stringify(exp)}`))
  ok ? pass++ : fail++
}

// computePageCount：四舍五入，至少 1 页
eq(computePageCount(0, 300), 1, 'pageCount 空内容=1')
eq(computePageCount(900, 300), 3, 'pageCount 900/300=3')
eq(computePageCount(901, 300), 3, 'pageCount 901/300≈3')
eq(computePageCount(300, 0), 1, 'pageCount step=0 兜底=1')

// ratio ↔ pageIndex（ratio 以 pageCount 为分母）
eq(ratioToPageIndex(0, 5), 0, 'ratio0→page0')
eq(ratioToPageIndex(0.8, 5), 4, 'ratio0.8×5=4')
eq(ratioToPageIndex(1, 5), 4, 'ratio1 夹到末页4')
eq(pageIndexToRatio(0, 5), 0, 'page0→ratio0')
eq(pageIndexToRatio(4, 5), 0.8, 'page4/5=0.8')
eq(pageIndexToRatio(0, 0), 0, 'pageCount0→ratio0')

// clampPage
eq(clampPage(-2, 5), 0, 'clamp 下界')
eq(clampPage(9, 5), 4, 'clamp 上界')

// resolveNextPage
eq(resolveNextPage({ pageIndex: 0, pageCount: 3, chapterIndex: 1, totalChapters: 4 }),
   { chapterIndex: 1, pageIndex: 1, crossedChapter: false, atEnd: false }, 'next 同章')
eq(resolveNextPage({ pageIndex: 2, pageCount: 3, chapterIndex: 1, totalChapters: 4 }),
   { chapterIndex: 2, pageIndex: 0, crossedChapter: true, atEnd: false }, 'next 跨章')
eq(resolveNextPage({ pageIndex: 2, pageCount: 3, chapterIndex: 3, totalChapters: 4 }),
   { chapterIndex: 3, pageIndex: 2, crossedChapter: false, atEnd: true }, 'next 全书末页')

// resolvePrevPage（跨章用 pageIndex:-1 表示"上一章末页"）
eq(resolvePrevPage({ pageIndex: 2, chapterIndex: 1 }),
   { chapterIndex: 1, pageIndex: 1, crossedChapter: false, atStart: false }, 'prev 同章')
eq(resolvePrevPage({ pageIndex: 0, chapterIndex: 1 }),
   { chapterIndex: 0, pageIndex: -1, crossedChapter: true, atStart: false }, 'prev 跨章→末页哨兵')
eq(resolvePrevPage({ pageIndex: 0, chapterIndex: 0 }),
   { chapterIndex: 0, pageIndex: 0, crossedChapter: false, atStart: true }, 'prev 全书首页')

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
