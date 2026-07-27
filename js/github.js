/**
 * 知行录 - GitHub API 模块
 * 通过 GitHub Contents API 读写博客数据，实现一键发布
 */

const github = {
    _configKey: 'zhixinglu_github_config',

    getConfig() {
        try {
            const raw = localStorage.getItem(this._configKey);
            return raw ? JSON.parse(raw) : null;
        } catch {
            return null;
        }
    },

    setConfig(config) {
        localStorage.setItem(this._configKey, JSON.stringify(config));
    },

    clearConfig() {
        localStorage.removeItem(this._configKey);
    },

    isConfigured() {
        const cfg = this.getConfig();
        return !!(cfg && cfg.token && cfg.owner && cfg.repo);
    },

    /**
     * 从 GitHub raw URL 读取 data.json（绕过缓存）
     */
    async fetchData() {
        const cfg = this.getConfig();
        const url = `https://raw.githubusercontent.com/${cfg.owner}/${cfg.repo}/${cfg.branch}/data.json?t=${Date.now()}`;
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`读取数据失败 (HTTP ${resp.status})`);
        return resp.json();
    },

    /**
     * 推送完整 data.json 到 GitHub
     */
    async pushData(data) {
        const cfg = this.getConfig();
        const content = JSON.stringify(data, null, 2);
        const base64Content = btoa(unescape(encodeURIComponent(content)));

        // 先取当前 SHA
        let sha = '';
        try {
            const getResp = await fetch(
                `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/data.json?ref=${cfg.branch}`,
                { headers: { Authorization: `token ${cfg.token}` } }
            );
            if (getResp.ok) {
                const info = await getResp.json();
                sha = info.sha;
            }
        } catch { /* 文件不存在时 sha 为空 */ }

        const body = {
            message: '📝 更新博客文章',
            content: base64Content,
            branch: cfg.branch
        };
        if (sha) body.sha = sha;

        const resp = await fetch(
            `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/data.json`,
            {
                method: 'PUT',
                headers: {
                    Authorization: `token ${cfg.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            }
        );

        if (!resp.ok) {
            const err = await resp.json().catch(() => ({}));
            throw new Error(err.message || `GitHub 推送失败 (HTTP ${resp.status})`);
        }

        return resp.json();
    }
};
