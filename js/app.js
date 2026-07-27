/**
 * 知行录 - 个人博客 SPA 应用
 * 功能：首页文章列表 / 文章详情 / 标签分类 / 关于页面 / 管理员编辑 / GitHub 一键发布
 */

const adminUI = {
    currentPost: null,
    editingSlug: null,

    init() {
        this.bindAdminBtn();
        this.bindLoginForm();
        this.bindEditorForm();
        this.bindEditorTabs();
        this.updateAdminUI();
    },

    // ============ 管理按钮 ============
    bindAdminBtn() {
        document.getElementById('adminBtn').addEventListener('click', () => {
            if (auth.isLoggedIn()) {
                this.showLogoutConfirm();
            } else {
                this.showLogin();
            }
        });
    },

    updateAdminUI() {
        const btn = document.getElementById('adminBtn');
        if (auth.isLoggedIn()) {
            btn.textContent = '👤';
            btn.classList.add('logged-in');
            btn.title = '管理员模式中 - 点击退出';
        } else {
            btn.textContent = '🔒';
            btn.classList.remove('logged-in');
            btn.title = '管理员登录';
        }
        app.handleRoute();
    },

    // ============ 登录 ============
    showLogin() {
        const modal = document.getElementById('loginModal');
        const title = document.getElementById('loginTitle');
        const desc = document.getElementById('loginDesc');
        const input = document.getElementById('loginPassword');
        const error = document.getElementById('loginError');
        const submit = document.getElementById('loginSubmit');
        const switchEl = document.getElementById('loginSwitch');

        modal.style.display = 'flex';
        input.value = '';
        error.textContent = '';

        title.textContent = '管理员登录';
        desc.textContent = '输入密码进入编辑模式';
        submit.textContent = '登 录';
        switchEl.innerHTML = '';
    },

    closeLogin() {
        document.getElementById('loginModal').style.display = 'none';
    },

    bindLoginForm() {
        document.getElementById('loginForm').addEventListener('submit', (e) => {
            e.preventDefault();
            const password = document.getElementById('loginPassword').value.trim();
            const error = document.getElementById('loginError');

            if (!password) {
                error.textContent = '请输入密码';
                return;
            }

            if (auth.login(password)) {
                auth.setLoggedIn();
                if (auth.isUsingDefault()) {
                    toast('登录成功！建议在设置中修改默认密码', 'success');
                } else {
                    toast('登录成功！已进入管理员模式', 'success');
                }
                this.closeLogin();
                this.updateAdminUI();
            } else {
                error.textContent = '密码错误，请重试';
            }
        });
    },

    showLogoutConfirm() {
        auth.logout();
        this.updateAdminUI();
        toast('已退出管理员模式', 'success');
    },

    // ============ 编辑器 ============
    openEditor(postSlug) {
        const data = dataStore.getData();
        const post = postSlug ? data.posts.find(p => p.slug === postSlug) : null;

        this.editingSlug = postSlug || null;
        document.getElementById('editorModal').style.display = 'flex';
        document.getElementById('editorTitle').textContent = post ? '编辑文章' : '新建文章';
        document.getElementById('editSave').textContent = post ? '💾 更新并发布' : '💾 发布文章';

        document.getElementById('editTitle').value = post ? post.title : '';
        document.getElementById('editCover').value = post ? post.cover : '';
        document.getElementById('editExcerpt').value = post ? post.excerpt : '';
        document.getElementById('editDate').value = post ? post.date : new Date().toISOString().split('T')[0];
        document.getElementById('editContent').value = post ? post.content : '';

        const tagsContainer = document.getElementById('editTags');
        tagsContainer.innerHTML = data.tags.map(t => `
            <span class="form-tag ${post && post.tags.includes(t.id) ? 'selected' : ''}" data-tag="${t.id}">
                ${t.icon} ${t.name}
            </span>
        `).join('');

        tagsContainer.querySelectorAll('.form-tag').forEach(el => {
            el.addEventListener('click', () => el.classList.toggle('selected'));
        });

        document.querySelector('.editor-tab[data-tab="write"]').classList.add('active');
        document.querySelector('.editor-tab[data-tab="preview"]').classList.remove('active');
        document.getElementById('editContent').style.display = 'block';
        document.getElementById('editPreview').style.display = 'none';
    },

    closeEditor() {
        document.getElementById('editorModal').style.display = 'none';
        this.editingSlug = null;
    },

    bindEditorTabs() {
        document.querySelectorAll('.editor-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const mode = tab.dataset.tab;
                document.querySelectorAll('.editor-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');

                const textarea = document.getElementById('editContent');
                const preview = document.getElementById('editPreview');

                if (mode === 'write') {
                    textarea.style.display = 'block';
                    preview.style.display = 'none';
                } else {
                    textarea.style.display = 'none';
                    preview.style.display = 'block';
                    marked.setOptions({ breaks: true, gfm: true });
                    preview.innerHTML = marked.parse(textarea.value || '*暂无内容*');
                }
            });
        });
    },

    bindEditorForm() {
        document.getElementById('editorForm').addEventListener('submit', async () => {
            const saveBtn = document.getElementById('editSave');
            const title = document.getElementById('editTitle').value.trim();
            const cover = document.getElementById('editCover').value.trim();
            const excerpt = document.getElementById('editExcerpt').value.trim();
            const date = document.getElementById('editDate').value;
            const content = document.getElementById('editContent').value.trim();

            const selectedTags = [];
            document.querySelectorAll('#editTags .form-tag.selected').forEach(el => {
                selectedTags.push(el.dataset.tag);
            });

            if (!title) { toast('请输入文章标题', 'error'); return; }
            if (!content) { toast('请输入文章内容', 'error'); return; }
            if (selectedTags.length === 0) { toast('请选择至少一个标签', 'error'); return; }

            const postData = {
                title,
                slug: this.editingSlug || '',
                cover: cover || 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80',
                excerpt: excerpt || content.replace(/[#*>\n`\[\]()]/g, '').slice(0, 120) + '...',
                date: date || new Date().toISOString().split('T')[0],
                tags: selectedTags,
                content
            };

            // 显示保存中状态
            saveBtn.textContent = '⏳ 发布中...';
            saveBtn.disabled = true;

            try {
                await dataStore.savePost(postData);
                const syncErr = dataStore.getSyncError();
                if (syncErr) {
                    // 本地已保存，但 GitHub 同步失败
                    const hint = syncErr.includes('未连接')
                        ? '请先去「关于」页面配置 GitHub 连接'
                        : '请检查网络后，去「关于」页面手动同步';
                    toast('⚠️ 已存本地，但发布失败：' + syncErr + '。' + hint, 'error');
                } else if (github.isConfigured()) {
                    toast((this.editingSlug ? '文章已更新' : '文章已发布') + '，同步到 GitHub 成功 🚀', 'success');
                } else {
                    toast('已保存到本地（未连接 GitHub，仅当前浏览器可见）', 'success');
                }
                this.closeEditor();
                await app.handleRoute();
            } catch (e) {
                toast('保存失败：' + e.message, 'error');
            } finally {
                saveBtn.textContent = this.editingSlug ? '💾 更新并发布' : '💾 发布文章';
                saveBtn.disabled = false;
            }
        });
    },

    // ============ 删除文章 ============
    async deletePost(slug) {
        const data = dataStore.getData();
        const post = data.posts.find(p => p.slug === slug);
        if (!post) return;

        if (confirm(`确定要删除文章「${post.title}」吗？\n此操作不可恢复！`)) {
            try {
                await dataStore.deletePost(slug);
                toast('文章已删除并同步', 'success');
                await app.handleRoute();
            } catch (e) {
                toast('删除失败：' + e.message, 'error');
            }
        }
    }
};

// ============ GitHub 配置界面 ============
const githubConfigUI = {
    show() {
        const cfg = github.getConfig();
        document.getElementById('githubConfigModal').style.display = 'flex';
        document.getElementById('ghOwner').value = cfg ? cfg.owner : '';
        document.getElementById('ghRepo').value = cfg ? cfg.repo : '';
        document.getElementById('ghBranch').value = cfg ? cfg.branch : 'main';
        document.getElementById('ghToken').value = cfg ? cfg.token : '';
        document.getElementById('ghStatus').textContent = '';
    },

    close() {
        document.getElementById('githubConfigModal').style.display = 'none';
    },

    async test() {
        const cfg = this._readForm();
        if (!cfg.token || !cfg.owner || !cfg.repo) {
            document.getElementById('ghStatus').textContent = '❌ 请填写所有字段';
            return;
        }
        github.setConfig(cfg);
        document.getElementById('ghStatus').textContent = '⏳ 测试中...';
        try {
            const data = await github.fetchData();
            document.getElementById('ghStatus').textContent = `✅ 连接成功！找到 ${data.posts.length} 篇文章`;
        } catch (e) {
            document.getElementById('ghStatus').textContent = '❌ 连接失败：' + e.message;
        }
    },

    async save() {
        const cfg = this._readForm();
        if (!cfg.token || !cfg.owner || !cfg.repo) {
            document.getElementById('ghStatus').textContent = '❌ 请填写所有字段';
            return;
        }
        github.setConfig(cfg);
        document.getElementById('ghStatus').textContent = '⏳ 保存并同步中...';

        try {
            // 先将本地数据推送到 GitHub
            await github.pushData(dataStore.exportData());
            dataStore._clearLocal();
            dataStore._hasLocalEdits = false;
            toast('GitHub 配置成功！数据已同步', 'success');
            this.close();
            await app.handleRoute();
        } catch (e) {
            document.getElementById('ghStatus').textContent = '❌ 推送失败：' + e.message;
        }
    },

    async disconnect() {
        if (!confirm('确定要断开 GitHub 连接吗？之后数据将只保存在当前浏览器中。')) return;
        github.clearConfig();
        dataStore._hasLocalEdits = true;
        const data = dataStore.getData();
        localStorage.setItem(dataStore._key, JSON.stringify({
            posts: data.posts, author: data.author, version: 3,
            updatedAt: new Date().toISOString()
        }));
        toast('已断开 GitHub 连接', 'success');
        this.close();
        await app.handleRoute();
    },

    _readForm() {
        return {
            owner: document.getElementById('ghOwner').value.trim(),
            repo: document.getElementById('ghRepo').value.trim(),
            branch: document.getElementById('ghBranch').value.trim() || 'main',
            token: document.getElementById('ghToken').value.trim()
        };
    }
};

// ============ 主应用 ============
const app = {
    currentRoute: '',
    _dataReady: false,

    async init() {
        this.bindNavToggle();
        this.bindRoute();
        adminUI.init();
        await dataStore.init();
        this._dataReady = true;
        await this.handleRoute();
    },

    // ============ Navigation ============
    bindNavToggle() {
        document.getElementById('navToggle').addEventListener('click', () => {
            document.getElementById('navLinks').classList.toggle('open');
        });
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', () => {
                document.getElementById('navLinks').classList.remove('open');
            });
        });
    },

    bindRoute() {
        window.addEventListener('hashchange', () => this.handleRoute());
    },

    async handleRoute() {
        if (!this._dataReady) await dataStore.init();
        this._dataReady = true;
        const hash = window.location.hash.slice(1) || '/';
        this.currentRoute = hash;
        this.updateActiveNav();
        this.render(hash);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    updateActiveNav() {
        document.querySelectorAll('.nav-link').forEach(link => {
            const route = link.getAttribute('data-route');
            if (route === this.currentRoute ||
                (route === '/' && (this.currentRoute.startsWith('/post/') || this.currentRoute === ''))) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });
    },

    navigate(route) {
        window.location.hash = route;
    },

    // ============ Render Router ============
    render(hash) {
        const container = document.getElementById('app');
        if (hash === '/' || hash === '') {
            this.renderHome(container);
        } else if (hash.startsWith('/post/')) {
            const slug = hash.replace('/post/', '');
            this.renderPost(container, slug);
        } else if (hash === '/tags' || hash.startsWith('/tag/')) {
            const tagId = hash.startsWith('/tag/') ? hash.replace('/tag/', '') : null;
            this.renderTags(container, tagId);
        } else if (hash === '/about') {
            this.renderAbout(container);
        } else {
            this.renderNotFound(container);
        }
    },

    getData() {
        return dataStore.getData();
    },

    isAdmin() {
        return auth.isLoggedIn();
    },

    // ============ Home Page ============
    renderHome(container) {
        const data = this.getData();
        const tags = data.tags.filter(t => t.count > 0).slice(0, 8);
        const isAdmin = this.isAdmin();

        container.innerHTML = `
            <section class="hero fade-in">
                <h1 class="hero-title">行走中的经济学思考</h1>
                <p class="hero-subtitle">记录旅途见闻，用经济学视角观察世界。在行走中思考，在思考中成长。</p>
                <div class="hero-tags">
                    ${tags.map(t => `
                        <span class="hero-tag" onclick="app.navigate('/tag/${t.id}')">
                            ${t.icon} ${t.name}
                        </span>
                    `).join('')}
                </div>
                ${isAdmin ? `
                <div class="admin-actions" style="margin-top:20px;">
                    <button class="admin-btn-new" onclick="adminUI.openEditor(null)">✏️ 新建文章</button>
                </div>` : ''}
            </section>
            <section>
                <h2 class="section-title">最新文章</h2>
                <div class="article-list">
                    ${data.posts.map(post => this.renderArticleCard(post, isAdmin)).join('')}
                </div>
            </section>
        `;
    },

    renderArticleCard(post, isAdmin) {
        const tagNames = post.tags.map(tid => {
            const tag = blogData.tags.find(t => t.id === tid);
            return tag ? tag.name : tid;
        }).slice(0, 3);

        return `
            <article class="article-card fade-in ${isAdmin ? 'admin-mode' : ''}">
                ${isAdmin ? `
                <div class="admin-card-actions">
                    <button class="admin-card-btn edit" title="编辑" onclick="event.stopPropagation(); adminUI.openEditor('${post.slug}')">✏️</button>
                    <button class="admin-card-btn delete" title="删除" onclick="event.stopPropagation(); adminUI.deletePost('${post.slug}')">🗑</button>
                </div>` : ''}
                <div class="article-card-inner ${isAdmin ? 'article-card-inner-wrapper' : ''}" 
                     onclick="app.navigate('/post/${post.slug}')">
                    <img class="article-card-image"
                         src="${post.cover}"
                         alt="${post.title}"
                         loading="lazy"
                         onerror="this.style.display='none'">
                    <div class="article-card-body">
                        <div class="article-card-date">${this.formatDate(post.date)}</div>
                        <h3 class="article-card-title">${post.title}</h3>
                        <p class="article-card-excerpt">${post.excerpt}</p>
                        <div class="article-card-tags">
                            ${tagNames.map(n => `<span class="article-card-tag">${n}</span>`).join('')}
                        </div>
                    </div>
                </div>
            </article>
        `;
    },

    // ============ Article Detail ============
    renderPost(container, slug) {
        const data = this.getData();
        const post = data.posts.find(p => p.slug === slug);

        if (!post) {
            this.renderNotFound(container);
            return;
        }

        marked.setOptions({ breaks: true, gfm: true });
        const htmlContent = marked.parse(post.content);
        const tagNames = post.tags.map(tid => {
            const tag = data.tags.find(t => t.id === tid);
            return tag ? { id: tid, name: tag.name, icon: tag.icon } : { id: tid, name: tid, icon: '' };
        });
        const isAdmin = this.isAdmin();

        document.title = `${post.title} - 知行录`;

        container.innerHTML = `
            <article class="article-detail fade-in">
                <header class="article-detail-header">
                    <a href="#/" class="article-detail-back" onclick="app.navigate('/')">← 返回首页</a>
                    <h1 class="article-detail-title">${post.title}</h1>
                    <div class="article-detail-meta">
                        <span>${this.formatDate(post.date)}</span>
                        <span>·</span>
                        <span>约 ${this.calculateReadTime(post.content)} 分钟阅读</span>
                    </div>
                    <div class="article-detail-tags">
                        ${tagNames.map(t => `
                            <span class="article-detail-tag" onclick="app.navigate('/tag/${t.id}')">
                                ${t.icon} ${t.name}
                            </span>
                        `).join('')}
                    </div>
                    ${isAdmin ? `
                    <div class="admin-actions">
                        <button class="admin-btn-edit" onclick="adminUI.openEditor('${post.slug}')">✏️ 编辑此文</button>
                        <button class="admin-btn-delete" onclick="adminUI.deletePost('${post.slug}')">🗑 删除此文</button>
                    </div>` : ''}
                </header>
                <img class="article-detail-cover"
                     src="${post.cover}"
                     alt="${post.title}"
                     onerror="this.style.display='none'">
                <div class="markdown-content">${htmlContent}</div>
            </article>
        `;
    },

    // ============ Tags Page ============
    renderTags(container, activeTagId) {
        const data = this.getData();

        if (activeTagId) {
            const tag = data.tags.find(t => t.id === activeTagId);
            const posts = data.posts.filter(p => p.tags.includes(activeTagId));

            if (!tag || posts.length === 0) {
                this.renderTags(container, null);
                return;
            }

            document.title = `${tag.name} - 知行录`;
            const isAdmin = this.isAdmin();

            container.innerHTML = `
                <div class="fade-in">
                    <a href="#/tags" class="article-detail-back" onclick="app.navigate('/tags')">← 所有标签</a>
                    <div class="tag-section-header" style="margin-top:24px;">
                        ${tag.icon} ${tag.name}
                        <span class="count">(${posts.length} 篇文章)</span>
                    </div>
                    <div class="article-list">
                        ${posts.map(post => this.renderArticleCard(post, isAdmin)).join('')}
                    </div>
                </div>
            `;
            return;
        }

        document.title = '标签分类 - 知行录';
        const tagsWithPosts = data.tags.filter(t => t.count > 0);

        container.innerHTML = `
            <div class="fade-in">
                <h1 class="tags-page-title">标签分类</h1>
                <p class="tags-page-desc">按主题浏览文章，找到你感兴趣的内容</p>
                <div class="tags-grid">
                    ${tagsWithPosts.map(t => `
                        <div class="tag-card" onclick="app.navigate('/tag/${t.id}')">
                            <div class="tag-card-icon">${t.icon}</div>
                            <div class="tag-card-name">${t.name}</div>
                            <div class="tag-card-count">${t.count} 篇文章</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    },

    // ============ About Page ============
    renderAbout(container) {
        const data = this.getData();
        document.title = '关于 - 知行录';

        const totalWords = data.posts.reduce((sum, p) => sum + p.content.length, 0);
        const tagCount = data.tags.filter(t => t.count > 0).length;
        const isAdmin = this.isAdmin();
        const ghConnected = github.isConfigured();
        const cfg = github.getConfig();

        container.innerHTML = `
            <div class="fade-in">
                <section class="about-section">
                    <div class="about-avatar">🌏</div>
                    <h1 class="about-name">${data.author.name}</h1>
                    <p class="about-location">📍 ${data.author.location}</p>
                    <p class="about-bio">${data.author.bio}</p>
                    <div class="about-links">
                        <a href="mailto:${data.author.email}" class="about-link">✉️ 联系我</a>
                        <a href="${data.author.github}" class="about-link" target="_blank">💻 GitHub</a>
                    </div>
                </section>

                ${isAdmin ? `
                <hr class="about-divider">
                <h2 class="about-subtitle">📡 发布状态</h2>
                <div class="gh-status-box">
                    ${ghConnected ? `
                        <div class="gh-status-row"><span class="gh-status-ok">🟢</span> GitHub 已连接</div>
                        <div class="gh-status-row"><strong>仓库：</strong>${cfg.owner}/${cfg.repo}</div>
                        <div class="gh-status-row"><strong>分支：</strong>${cfg.branch}</div>
                        <div class="gh-status-row" style="margin-top:8px;color:var(--accent);font-weight:600;">
                            🚀 编辑后保存即实时发布，全网可见！
                        </div>
                    ` : `
                        <div class="gh-status-row"><span class="gh-status-warn">🟡</span> 未连接 GitHub</div>
                        <div class="gh-status-row" style="color:var(--text-muted);">编辑的文章仅当前浏览器可见，配置 GitHub 后即可一键发布。</div>
                    `}
                </div>
                ` : ''}

                <hr class="about-divider">

                <h2 class="about-subtitle">站点统计</h2>
                <div class="about-stats">
                    <div class="about-stat">
                        <div class="about-stat-num">${data.posts.length}</div>
                        <div class="about-stat-label">篇文章</div>
                    </div>
                    <div class="about-stat">
                        <div class="about-stat-num">${tagCount}</div>
                        <div class="about-stat-label">个标签</div>
                    </div>
                    <div class="about-stat">
                        <div class="about-stat-num">${Math.round(totalWords / 500)}</div>
                        <div class="about-stat-label">分钟阅读</div>
                    </div>
                </div>

                <hr class="about-divider">

                <h2 class="about-subtitle">关于这个博客</h2>
                <div class="markdown-content" style="text-align:left; max-width:600px; margin:0 auto;">
                    <p>知行录，取「<strong>知行合一</strong>」之意。</p>
                    <p>行万里路，读万卷书。这个博客记录的是一位旅行者和经济学爱好者的双重旅程：在世界的不同角落，用经济学的视角观察和理解人类社会。</p>
                    <p>这里有：</p>
                    <ul>
                        <li><strong>旅途见闻</strong>：日本、欧洲、东南亚等地的旅行故事和观察</li>
                        <li><strong>经济学思考</strong>：从行为经济学到宏观经济学，用理论理解现实</li>
                        <li><strong>美食与文化</strong>：菜市场、街头小吃背后的社会经济学</li>
                        <li><strong>摄影笔记</strong>：用镜头记录那些经济学解释不了的瞬间</li>
                    </ul>
                    <p>如果你也喜欢在旅途中思考，欢迎通过邮件与我交流。每一段旅程都是一次经济学实验，让我们一起探索这个有趣的世界。</p>
                </div>

                ${isAdmin ? `
                <hr class="about-divider">
                <h2 class="about-subtitle">管理工具</h2>
                <div class="admin-actions">
                    <button class="admin-btn-new" onclick="adminUI.openEditor(null)">✏️ 新建文章</button>
                    <button class="admin-btn-edit" onclick="exportDataFile()">📥 导出文件备份</button>
                    <button class="admin-btn-edit" onclick="githubConfigUI.show()">⚙️ 配置 GitHub</button>
                    ${ghConnected ? `<button class="admin-btn-edit" onclick="forceSyncNow()">🔃 强制同步到 GitHub</button>` : ''}
                    <button class="admin-btn-delete" onclick="if(confirm('确定要重置所有数据吗？')){dataStore.resetToDefault();app.handleRoute();toast('已重置','success')}">🔄 重置数据</button>
                </div>` : ''}
            </div>
        `;
    },

    // ============ Not Found ============
    renderNotFound(container) {
        document.title = '404 - 知行录';
        container.innerHTML = `
            <div class="fade-in" style="text-align:center; padding:60px 0;">
                <div style="font-size:4rem; margin-bottom:20px;">🔍</div>
                <h1 style="font-family:'Noto Serif SC',serif; font-size:1.8rem; margin-bottom:12px;">页面未找到</h1>
                <p style="color:var(--text-muted); margin-bottom:24px;">你寻找的页面可能已经搬家了</p>
                <a href="#/" class="about-link" onclick="app.navigate('/')">← 回到首页</a>
            </div>
        `;
    },

    // ============ Utilities ============
    formatDate(dateStr) {
        const date = new Date(dateStr);
        return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
    },

    calculateReadTime(content) {
        const chineseChars = (content.match(/[\u4e00-\u9fff]/g) || []).length;
        const words = content.split(/\s+/).length;
        return Math.max(1, Math.ceil(chineseChars / 300 + words / 200));
    }
};

// ============ 强制同步 ============
async function forceSyncNow() {
    try {
        await dataStore.syncToGitHub();
        toast('全部数据已同步到 GitHub 🚀', 'success');
    } catch (e) {
        toast('同步失败：' + e.message, 'error');
    }
}

// ============ 导出数据文件 ============
function exportDataFile() {
    const data = dataStore.exportData();
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'data.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast('数据文件已下载！（备份用）', 'success');
}

// ============ Toast 通知 ============
function toast(message, type = '') {
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = message;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3000);
}

// ============ 点击遮罩关闭弹窗 ============
document.addEventListener('click', (e) => {
    if (e.target.id === 'loginModal') adminUI.closeLogin();
    if (e.target.id === 'editorModal') adminUI.closeEditor();
    if (e.target.id === 'githubConfigModal') githubConfigUI.close();
});

// ============ 键盘快捷键 ============
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if (document.getElementById('githubConfigModal').style.display === 'flex') {
            githubConfigUI.close();
        } else if (document.getElementById('editorModal').style.display === 'flex') {
            adminUI.closeEditor();
        } else if (document.getElementById('loginModal').style.display === 'flex') {
            adminUI.closeLogin();
        }
    }
    if (e.key === 'Enter' && document.getElementById('loginModal').style.display === 'flex') {
        document.getElementById('loginForm').dispatchEvent(new Event('submit'));
    }
});

// 初始化
document.addEventListener('DOMContentLoaded', () => app.init());
