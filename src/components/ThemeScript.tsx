/**
 * 초기 렌더 전 다크모드 클래스를 적용해 깜빡임(FOUC)을 방지한다.
 * localStorage의 설정을 읽어 <html>에 dark 클래스를 토글.
 */
export function ThemeScript() {
  const code = `(function(){try{var s=localStorage.getItem('cb_settings');var dark=false;if(s){dark=JSON.parse(s).darkMode===true;}if(dark){document.documentElement.classList.add('dark');}}catch(e){}})();`;
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
