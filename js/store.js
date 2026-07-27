/**
 * 知行录 - 数据持久化 & 编辑器
 * 优先从 GitHub 加载数据，支持一键发布
 */

const dataStore = {
    _key: 'zhixinglu_posts',
    _cachedData: null,
    _hasLocalEdits: false,
    _lastSyncError: null,
    // 公开的 GitHub 仓库信息，所有访问者都能读取
    _publicRepo: { owner: 'Wimlg', repo: 'Wimlg', branch: 'main' },

    /** 从 GitHub 加载数据，优先 API（实时），再 raw URL（CDN），10秒超时 */
    async _loadFromGitHub() {
        // 方法1: GitHub API（实时，无缓存）
        let data = await this._fetchViaApi();
        if (data) { console.log('[知行录] 通过 API 加载成功'); return data; }

        // 方法2: raw URL（有CDN延迟，但兼容性好）
        data = await this._fetchViaRaw();
        if (data) { console.log('[知行录] 通过 raw URL 加载成功'); return data; }

        // 方法3: 延迟重试 raw URL（CDN 可能刚更新）
        console.log('[知行录] 首次加载失败，2秒后重试...');
        await new Promise(r => setTimeout(r, 2000));
        data = await this._fetchViaRaw();
        if (data) { console.log('[知行录] 重试 raw URL 成功'); return data; }

        return null;
    },

    /**
     * 初始化数据（异步）
     * 远程 GitHub 为权威来源 → 本地缓存兜底 → 默认数据保底
     */
    async init() {
        // 1. 远程 GitHub 数据（权威）
        const remoteData = await this._loadFromGitHub();
        if (remoteData && remoteData.posts && remoteData.posts.length > 0) {
            this._cachedData = {
                ...this._cloneDefault(),
                author: remoteData.author || this._cloneDefault().author
            };
            this._cachedData.posts = this._mergePostsKeepDefaults(remoteData.posts);
            this._syncTagCounts(this._cachedData);
            this._saveLocal({ posts: this._cachedData.posts, author: this._cachedData.author });
            this._hasLocalEdits = false;
            console.log('[知行录] 远程数据:', remoteData.posts.length, '篇 → 合并后:', this._cachedData.posts.length, '篇');
        } else {
            // 2. 本地缓存兜底
            console.warn('[知行录] GitHub 加载失败，使用本地缓存');
            this._cachedData = this._cloneDefault();
            const local = this._getLocal();
            if (local && local.posts && local.posts.length > 0) {
                this._cachedData = this._mergeData(this._cachedData, local);
                this._hasLocalEdits = true;
            }
        }

        return this._cachedData;
    },

    /** 将远程文章列表与默认文章合并，确保默认文章永远不丢 */
    _mergePostsKeepDefaults(remotePosts) {
        const defaults = JSON.parse(JSON.stringify(blogData.posts));
        const merged = [...remotePosts];
        defaults.forEach(defPost => {
            if (!merged.find(p => p.slug === defPost.slug || p.id === defPost.id)) {
                merged.push(defPost);
            }
        });
        merged.sort((a, b) => new Date(b.date) - new Date(a.date));
        return merged;
    },

    /** 通过 GitHub Contents API 获取实时数据（无CDN缓存），10秒超时 */
    async _fetchViaApi() {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 10000);
        try {
            const apiUrl = `https://api.github.com/repos/${this._publicRepo.owner}/${this._publicRepo.repo}/contents/data.json?ref=${this._publicRepo.branch}`;
            const resp = await fetch(apiUrl, { signal: ctrl.signal });
            if (!resp.ok) return null;
            const fileInfo = await resp.json();
            if (!fileInfo.content) return null;
            // 解码 base64 → UTF-8（支持中文等多字节字符）
            const cleanB64 = fileInfo.content.replace(/\s/g, '');
            const binaryStr = atob(cleanB64);
            const bytes = new Uint8Array(binaryStr.length);
            for (let i = 0; i < binaryStr.length; i++) {
                bytes[i] = binaryStr.charCodeAt(i);
            }
            const content = new TextDecoder('utf-8').decode(bytes);
            return JSON.parse(content);
        } catch { return null; }
        finally { clearTimeout(timer); }
    },

    /** 通过 raw.githubusercontent.com 获取数据，10秒超时 */
    async _fetchViaRaw() {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 10000);
        try {
            const publicUrl = `https://raw.githubusercontent.com/${this._publicRepo.owner}/${this._publicRepo.repo}/${this._publicRepo.branch}/data.json?t=${Date.now()}`;
            const resp = await fetch(publicUrl, { signal: ctrl.signal });
            if (!resp.ok) return null;
            return await resp.json();
        } catch { return null; }
        finally { clearTimeout(timer); }
    },

    /** 同步获取数据（初始化后调用），保证默认文章永远存在 */
    getData() {
        const data = this._cachedData || this._cloneDefault();
        // 确保默认文章不丢失：如果 cachedData 中没有某篇默认文章，补回来
        const defaults = blogData.posts;
        if (defaults && defaults.length > 0 && data.posts) {
            defaults.forEach(defPost => {
                if (!data.posts.find(p => p.slug === defPost.slug || p.id === defPost.id)) {
                    data.posts.push(JSON.parse(JSON.stringify(defPost)));
                }
            });
            data.posts.sort((a, b) => new Date(b.date) - new Date(a.date));
        }
        return data;
    },

    /** 获取单篇文章 */
    getPost(slug) {
        const data = this.getData();
        return data.posts.find(p => p.slug === slug);
    },

    /**
     * 保存/更新文章（异步）
     * 核心：先保存到本地，再推 GitHub，保证数据绝不丢失
     */
    async savePost(post) {
        const data = this.getData();
        const idx = data.posts.findIndex(p => p.slug === (post.slug || '') || p.id === post.id);
        if (idx >= 0) {
            data.posts[idx] = { ...data.posts[idx], ...post };
        } else {
            post.id = Date.now();
            if (!post.slug) post.slug = this._generateSlug(post.title);
            data.posts.unshift(post);
        }
        data.posts.sort((a, b) => new Date(b.date) - new Date(a.date));
        this._syncTagCounts(data);
        this._cachedData = data;

        // 无论如何先保存到本地——数据绝不丢失
        this._saveLocal(data);
        this._hasLocalEdits = false;
        this._lastSyncError = null;

        // 然后尝试推送到 GitHub
        if (github.isConfigured()) {
            try {
                const payload = this.exportData();
                await github.pushData(payload);
                console.log('[知行录] GitHub 推送成功，共', data.posts.length, '篇文章');
                this._lastSyncError = null;
            } catch (e) {
                console.warn('[知行录] GitHub 推送失败:', e.message, '已保存到本地');
                this._hasLocalEdits = true;
                this._lastSyncError = e.message;
            }
        } else {
            this._hasLocalEdits = true;
            this._lastSyncError = 'GitHub 未连接';
        }

        return post;
    },

    /**
     * 删除文章（异步）
     */
    async deletePost(slug) {
        const data = this.getData();
        data.posts = data.posts.filter(p => p.slug !== slug);
        this._syncTagCounts(data);
        this._cachedData = data;

        // 先保存到本地
        this._saveLocal(data);
        this._hasLocalEdits = false;
        this._lastSyncError = null;

        // 再推 GitHub
        if (github.isConfigured()) {
            try {
                await github.pushData(this.exportData());
                this._lastSyncError = null;
            } catch (e) {
                console.warn('[知行录] GitHub 删除推送失败:', e.message);
                this._hasLocalEdits = true;
                this._lastSyncError = e.message;
            }
        } else {
            this._hasLocalEdits = true;
            this._lastSyncError = 'GitHub 未连接';
        }
    },

    /** 将全部数据强制同步到 GitHub（管理员手动操作） */
    async syncToGitHub() {
        if (!github.isConfigured()) throw new Error('请先配置 GitHub 连接');
        const data = this.getData();
        const payload = this.exportData();
        await github.pushData(payload);
        this._saveLocal(data);
        this._hasLocalEdits = false;
        this._lastSyncError = null;
        console.log('[知行录] 全部数据已同步到 GitHub，共', data.posts.length, '篇文章');
    },

    /** 是否有未同步的本地编辑 */
    hasLocalEdits() {
        return this._hasLocalEdits;
    },

    /** 获取最近一次同步错误 */
    getSyncError() {
        return this._lastSyncError;
    },

    /** 重置为默认数据 */
    resetToDefault() {
        this._clearLocal();
        this._cachedData = this._cloneDefault();
        this._hasLocalEdits = false;
    },

    /** 导出数据（用于生成 data.json） */
    exportData() {
        const data = this.getData();
        return {
            author: data.author,
            posts: data.posts.map(p => ({
                id: p.id,
                title: p.title,
                slug: p.slug,
                date: p.date,
                tags: p.tags,
                cover: p.cover,
                excerpt: p.excerpt,
                content: p.content
            }))
        };
    },

    // ============ 内部方法 ============

    _getLocal() {
        try {
            const raw = localStorage.getItem(this._key);
            return raw ? JSON.parse(raw) : null;
        } catch { return null; }
    },

    _saveLocal(data) {
        localStorage.setItem(this._key, JSON.stringify({
            posts: data.posts,
            author: data.author,
            version: 3,
            updatedAt: new Date().toISOString()
        }));
    },

    _clearLocal() {
        localStorage.removeItem(this._key);
    },

    _cloneDefault() {
        return {
            posts: JSON.parse(JSON.stringify(blogData.posts)),
            author: JSON.parse(JSON.stringify(blogData.author)),
            tags: JSON.parse(JSON.stringify(blogData.tags))
        };
    },

    _mergeData(defaultData, localData) {
        if (!localData.posts) return defaultData;
        const mergedPosts = [...localData.posts];
        defaultData.posts.forEach(defPost => {
            if (!mergedPosts.find(p => p.slug === defPost.slug || p.id === defPost.id)) {
                mergedPosts.push(defPost);
            }
        });
        mergedPosts.sort((a, b) => new Date(b.date) - new Date(a.date));
        return {
            posts: mergedPosts,
            author: localData.author || defaultData.author,
            tags: defaultData.tags
        };
    },

    _syncTagCounts(data) {
        data.tags.forEach(tag => {
            tag.count = data.posts.filter(p => p.tags && p.tags.includes(tag.id)).length;
        });
    },

    _generateSlug(title) {
        const base = title.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
        return (base.slice(0, 30) + '-' + Date.now().toString(36)).toLowerCase();
    }
};
