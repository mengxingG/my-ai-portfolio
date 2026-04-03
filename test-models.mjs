import { ProxyAgent, setGlobalDispatcher } from 'undici';
import { GoogleGenerativeAI } from "@google/generative-ai";

// 1. 强制注入代理
const proxyAgent = new ProxyAgent('http://127.0.0.1:7897');
setGlobalDispatcher(proxyAgent);

// 2. 这里的 Key 替换为你自己的
const apiKey = "AIzaSyB37daAWB_Vr6wjkIpFSOf2-fI5SEcoMSo"; 
const genAI = new GoogleGenerativeAI(apiKey);

const listModels = async () => {
  try {
    console.log("正在请求 Google API 获取模型列表...");
    const response = await fetch(`https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`);
    
    if (!response.ok) {
        const errorData = await response.json();
        console.error("API 返回错误:", errorData);
        return;
    }

    const data = await response.json();
    console.log("✅ 你的账户可用的模型列表：");
    // 过滤出支持生成内容（generateContent）的模型
    const availableModels = data.models
      .filter(m => m.supportedGenerationMethods.includes('generateContent'))
      .map(m => m.name.replace('models/', ''));
    
    console.table(availableModels);
  } catch (err) {
    console.error("❌ 依然无法连接:", err.message);
  }
};

listModels();