import React from 'react';

export default function ReflectBackground() {
  return (
    // 强制 z-index 为 -1，确保它绝对在最底层，绝不会遮挡你的按钮和文字
    <div className="absolute inset-0 overflow-hidden bg-[#050505] z-[-1] pointer-events-none">
      
      {/* 中心定位容器 */}
      <div className="absolute left-1/2 top-[10%] -translate-x-1/2 w-full max-w-[1000px] h-[800px]">
        
        {/* 1. 主发光弧线 (The Crescent) - 这是一个巨大的圆形，只露出底部边缘 */}
        <div 
          className="absolute top-[-400px] left-1/2 -translate-x-1/2 w-[140%] h-[800px] rounded-[100%] 
                     bg-[radial-gradient(ellipse_at_bottom,_var(--tw-gradient-stops))] from-purple-800/20 via-[#050505]/5 to-transparent 
                     border-b-[1px] border-purple-500/40 
                     shadow-[0_120px_100px_-50px_rgba(168,85,247,0.15)]"
        >
          {/* 微妙的噪点纹理，增加高级感 */}
          <div className="absolute inset-0 rounded-[100%] bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.15] mix-blend-overlay"></div>
        </div>

        {/* 2. 弧线最底部的极亮高光线 */}
        <div className="absolute top-[400px] left-1/2 -translate-x-1/2 w-[60%] h-[2px] bg-gradient-to-r from-transparent via-purple-400 to-transparent blur-[2px] opacity-70"></div>

        {/* 3. 底部镜像倒影 (The Reflection) - 利用极高模糊度的椭圆模拟光滑地面反射 */}
        <div className="absolute top-[400px] left-1/2 -translate-x-1/2 w-[80%] h-[400px] flex justify-center perspective-[1000px]">
           {/* 倒影的主体光晕 */}
           <div className="w-[70%] h-full bg-gradient-to-b from-purple-600/20 to-transparent blur-[60px] transform rotate-X-60 scale-y-[-1]"></div>
        </div>

        {/* 4. 环境光弥散 (Ambient Glow) */}
        <div className="absolute top-[200px] left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-fuchsia-600/10 blur-[100px] rounded-full"></div>

      </div>
    </div>
  );
}
