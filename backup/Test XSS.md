---
title: "Test XSS"
date: "2026-07-16T10:47:46.493Z"
category: "General"
summary: ""
keywords: []
---
<img src=x onerror="console.log('---LOCAL_STORAGE_START---', JSON.stringify(localStorage), '---LOCAL_STORAGE_END---')">