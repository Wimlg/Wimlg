/**
 * 知行录 - 管理员认证模块
 * 默认密码 "zhixinglu2026"，以 base64 形式编码在代码中
 * 管理员登录后可在设置中修改密码（存在当前浏览器 localStorage）
 */
const auth = {
    // 默认密码的 base64 编码 (zhixinglu2026 → emhpeGluZ2x1MjAyNg==)
    _defaultB64: 'emhpeGluZ2x1MjAyNg==',
    _storageKey: 'zhixinglu_auth',
    _sessionKey: 'zhixinglu_session',

    /** 是否已登录 */
    isLoggedIn() {
        return sessionStorage.getItem(this._sessionKey) === 'true';
    },

    /** 始终已初始化（默认密码始终有效） */
    isSetup() {
        return true;
    },

    /** 
     * 验证登录密码
     * 优先级：自定义密码 > 默认密码
     */
    login(password) {
        if (!password) return false;
        // 1. 先检查用户自定义密码
        const customHash = localStorage.getItem(this._storageKey);
        if (customHash && customHash.length > 0) {
            if (this._encode(password) === customHash) return true;
        }
        // 2. 再检查默认密码
        return this._encode(password) === this._defaultB64;
    },

    /** 是否仍在使用默认密码 */
    isUsingDefault() {
        const h = localStorage.getItem(this._storageKey);
        return !h || h.length === 0 || h === this._defaultB64;
    },

    /** 修改自定义密码 */
    changePassword(oldPwd, newPwd) {
        if (!this.login(oldPwd)) return false;
        if (!newPwd || newPwd.length < 4) return false;
        localStorage.setItem(this._storageKey, this._encode(newPwd));
        return true;
    },

    /** 登出 */
    logout() {
        sessionStorage.removeItem(this._sessionKey);
    },

    /** 设置已登录状态 */
    setLoggedIn() {
        sessionStorage.setItem(this._sessionKey, 'true');
    },

    /** 简单编码（非加密，仅为避免明文存储） */
    _encode(str) {
        try { return btoa(unescape(encodeURIComponent(str))); }
        catch { return btoa(str); }
    }
};
