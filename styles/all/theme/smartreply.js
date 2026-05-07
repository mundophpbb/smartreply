document.addEventListener('DOMContentLoaded', function () {
    var config = document.getElementById('smartreply-config');
    if (!config) {
        return;
    }

    var textarea = document.querySelector('textarea[name="message"]');
    if (!textarea || !textarea.form) {
        return;
    }

    var form = textarea.form;
    var topicId = config.dataset.topicId || '0';
    var storageKey = 'mundophpbb.smartreply.' + topicId;
    var heightStorageKey = storageKey + '.height';
    var autosaveEnabled = config.dataset.autosave === '1';
    var autoExpand = config.dataset.autoExpand === '1';
    var showSnippet = config.dataset.showSnippet === '1';
    var startOpen = config.dataset.startOpen === '1';
    var persistContext = config.dataset.persistContext === '1';
    var compactToolbar = config.dataset.compactToolbar === '1';
    var fullEditorUrl = config.dataset.fullEditorUrl || form.getAttribute('action') || '#';
    var previewVisible = false;
    var toolbarExpanded = !compactToolbar;
    var mentionState = { active: false, start: 0, end: 0, query: '', items: [], index: 0 };
    var smilies = [];
    var prefersReducedMotion = false;
    var lastMeasuredTextareaHeight = Math.round(textarea.offsetHeight || 0);

    try {
        prefersReducedMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch (error) {
        prefersReducedMotion = false;
    }

    function ensureHiddenInput(name) {
        var input = form.querySelector('[name="' + name + '"]');
        if (input) {
            return input;
        }
        input = document.createElement('input');
        input.type = 'hidden';
        input.name = name;
        input.value = '';
        form.appendChild(input);
        return input;
    }

    var contextPostId = ensureHiddenInput('sr_context_post_id');
    var contextPostIndex = ensureHiddenInput('sr_context_post_index');
    var contextUsername = ensureHiddenInput('sr_context_username');
    var contextUserColour = ensureHiddenInput('sr_context_user_colour');
    var contextSubject = ensureHiddenInput('sr_context_subject');
    var contextSnippet = ensureHiddenInput('sr_context_snippet');
    var contextMode = ensureHiddenInput('sr_context_mode');
    var originalTextareaPlaceholder = textarea.getAttribute('placeholder') || '';

    var mobileActionsMedia = null;

    try {
        mobileActionsMedia = window.matchMedia('(max-width: 700px)');
    } catch (error) {
        mobileActionsMedia = null;
    }

    function isMobileActionsLayout() {
        if (mobileActionsMedia) {
            return !!mobileActionsMedia.matches;
        }
        return window.innerWidth <= 700;
    }

    function syncMobilePostActions() {
        var isMobile = isMobileActionsLayout();

        document.querySelectorAll('.postbody').forEach(function (postBody) {
            var postButtons = postBody.querySelector('.post-buttons');
            if (!postButtons) {
                return;
            }

            var originalButtons = postButtons.querySelectorAll('.smartreply-post-button > a');
            var mobileRow = postBody.querySelector('.smartreply-mobile-actions');

            if (!originalButtons.length) {
                if (mobileRow) {
                    mobileRow.remove();
                }
                return;
            }

            if (!isMobile) {
                if (mobileRow) {
                    mobileRow.remove();
                }
                return;
            }

            if (!mobileRow) {
                mobileRow = document.createElement('div');
                mobileRow.className = 'smartreply-mobile-actions';
                postButtons.insertAdjacentElement('afterend', mobileRow);
            }

            mobileRow.textContent = '';

            originalButtons.forEach(function (button, index) {
                var proxy = button.cloneNode(true);
                proxy.classList.add('smartreply-mobile-proxy');
                proxy.removeAttribute('aria-pressed');
                proxy.addEventListener('click', function (event) {
                    event.preventDefault();
                    button.click();
                });
                if (!proxy.id) {
                    proxy.id = 'smartreply-mobile-proxy-' + (button.dataset.postId || '0') + '-' + index;
                }
                mobileRow.appendChild(proxy);
            });
        });
    }

    form.classList.add('smartreply-form');
    form.id = form.id || 'smartreply-composer';
    form.classList.add(startOpen ? 'smartreply-expanded' : 'smartreply-collapsed');

    var contextBox = document.createElement('div');
    contextBox.className = 'smartreply-context';
    contextBox.hidden = true;
    contextBox.setAttribute('role', 'status');
    contextBox.setAttribute('aria-live', 'polite');
    contextBox.innerHTML = '' +
        '<div class="smartreply-context-icon smartreply-context-icon-reply" aria-hidden="true"><i class="icon fa-reply fa-fw"></i></div>' +
        '<div class="smartreply-context-main">' +
            '<div class="smartreply-context-line"></div>' +
            '<div class="smartreply-context-sub"></div>' +
            '<div class="smartreply-context-snippet"></div>' +
        '</div>' +
        '<div class="smartreply-context-actions">' +
            '<button type="button" class="smartreply-btn smartreply-context-jump"></button>' +
            '<button type="button" class="smartreply-btn smartreply-context-remove"></button>' +
        '</div>';

    var draftBox = document.createElement('div');
    draftBox.className = 'smartreply-draft';
    draftBox.hidden = true;
    draftBox.innerHTML = '' +
        '<div class="smartreply-context-title"></div>' +
        '<div class="smartreply-actions">' +
            '<button type="button" class="smartreply-btn smartreply-draft-restore"></button>' +
            '<button type="button" class="smartreply-btn smartreply-draft-later"></button>' +
            '<button type="button" class="smartreply-btn smartreply-draft-discard"></button>' +
        '</div>';

    var templateBox = document.createElement('div');
    templateBox.className = 'smartreply-templates';
    templateBox.hidden = true;
    templateBox.innerHTML = '' +
        '<div class="smartreply-templates-title"></div>' +
        '<div class="smartreply-actions smartreply-template-actions"></div>';

    var toolbarBox = document.createElement('div');
    toolbarBox.className = 'smartreply-toolbar';
    toolbarBox.innerHTML = '' +
        '<div class="smartreply-toolbar-title"></div>' +
        '<div class="smartreply-actions smartreply-toolbar-actions"></div>';

    var colorPaletteBox = document.createElement('div');
    colorPaletteBox.className = 'smartreply-color-palette';
    colorPaletteBox.hidden = true;
    colorPaletteBox.innerHTML = '' +
        '<div class="smartreply-color-title"></div>' +
        '<div class="smartreply-color-swatches"></div>' +
        '<div class="smartreply-color-actions"></div>';

    var helper = document.createElement('div');
    helper.className = 'smartreply-helper';
    helper.innerHTML = '' +
        '<div class="smartreply-helper-main">' +
            '<div class="smartreply-actions smartreply-helper-actions">' +
                '<button type="button" class="smartreply-btn smartreply-preview-toggle"></button>' +
                '<button type="button" class="smartreply-btn smartreply-clear-message"></button>' +
                '<button type="button" class="smartreply-btn smartreply-draft-reopen" hidden></button>' +
            '</div>' +
            '<div class="smartreply-save-status"></div>' +
            '<div class="smartreply-statebar" aria-live="polite"></div>' +
        '</div>';

    var previewBox = document.createElement('div');
    previewBox.className = 'smartreply-preview';
    previewBox.hidden = true;
    previewBox.innerHTML = '' +
        '<div class="smartreply-preview-title"></div>' +
        '<div class="smartreply-preview-body"></div>';

    var smiliesBox = document.createElement('div');
    smiliesBox.className = 'smartreply-smilies';
    smiliesBox.hidden = true;
    smiliesBox.innerHTML = '' +
        '<div class="smartreply-smilies-title"></div>' +
        '<div class="smartreply-smilies-list"></div>' +
        '<div class="smartreply-smilies-empty"></div>';

    var mentionBox = document.createElement('div');
    mentionBox.className = 'smartreply-mentions';
    mentionBox.hidden = true;
    mentionBox.innerHTML = '' +
        '<div class="smartreply-mentions-title"></div>' +
        '<div class="smartreply-mentions-list"></div>' +
        '<div class="smartreply-mentions-empty"></div>';

    var textareaParent = textarea.parentNode;
    var editorGrid = document.createElement('div');
    editorGrid.className = 'smartreply-editor-grid';

    textareaParent.insertBefore(draftBox, textarea);
    textareaParent.insertBefore(contextBox, textarea);
    textareaParent.insertBefore(templateBox, textarea);
    textareaParent.insertBefore(toolbarBox, textarea);
    textareaParent.insertBefore(colorPaletteBox, textarea);
    textareaParent.insertBefore(mentionBox, textarea);
    textareaParent.insertBefore(editorGrid, textarea);
    editorGrid.appendChild(textarea);
    editorGrid.appendChild(smiliesBox);

    if (editorGrid.nextSibling) {
        textareaParent.insertBefore(helper, editorGrid.nextSibling);
        if (helper.nextSibling) {
            textareaParent.insertBefore(previewBox, helper.nextSibling);
        } else {
            textareaParent.appendChild(previewBox);
        }
    } else {
        textareaParent.appendChild(helper);
        textareaParent.appendChild(previewBox);
    }

    var contextIconEl = contextBox.querySelector('.smartreply-context-icon');
    var lineEl = contextBox.querySelector('.smartreply-context-line');
    var subEl = contextBox.querySelector('.smartreply-context-sub');
    var snippetEl = contextBox.querySelector('.smartreply-context-snippet');
    var jumpBtn = contextBox.querySelector('.smartreply-context-jump');
    var removeBtn = contextBox.querySelector('.smartreply-context-remove');
    var draftTitle = draftBox.querySelector('.smartreply-context-title');
    var restoreBtn = draftBox.querySelector('.smartreply-draft-restore');
    var laterBtn = draftBox.querySelector('.smartreply-draft-later');
    var discardBtn = draftBox.querySelector('.smartreply-draft-discard');
    var fullEditorLink = helper.querySelector('.smartreply-open-full');
    var previewToggle = helper.querySelector('.smartreply-preview-toggle');
    var clearMessageBtn = helper.querySelector('.smartreply-clear-message');
    var reopenDraftBtn = helper.querySelector('.smartreply-draft-reopen');
    var saveStatus = helper.querySelector('.smartreply-save-status');
    var stateBar = helper.querySelector('.smartreply-statebar');
    var submitBtn = form.querySelector('[name="post"], button[type="submit"], input[type="submit"]');
    var templateTitle = templateBox.querySelector('.smartreply-templates-title');
    var templateActions = templateBox.querySelector('.smartreply-template-actions');
    var toolbarTitle = toolbarBox.querySelector('.smartreply-toolbar-title');
    var toolbarActions = toolbarBox.querySelector('.smartreply-toolbar-actions');
    var colorTitle = colorPaletteBox.querySelector('.smartreply-color-title');
    var colorSwatches = colorPaletteBox.querySelector('.smartreply-color-swatches');
    var colorActions = colorPaletteBox.querySelector('.smartreply-color-actions');
    var customColorInput = null;
    var toolbarToggle = null;
    var previewTitle = previewBox.querySelector('.smartreply-preview-title');
    var previewBody = previewBox.querySelector('.smartreply-preview-body');
    var smiliesTitle = smiliesBox.querySelector('.smartreply-smilies-title');
    var smiliesList = smiliesBox.querySelector('.smartreply-smilies-list');
    var smiliesEmpty = smiliesBox.querySelector('.smartreply-smilies-empty');
    var mentionTitle = mentionBox.querySelector('.smartreply-mentions-title');
    var mentionList = mentionBox.querySelector('.smartreply-mentions-list');
    var mentionEmpty = mentionBox.querySelector('.smartreply-mentions-empty');

    function focusTextarea(moveCaretToEnd) {
        try {
            textarea.focus({ preventScroll: true });
        } catch (error) {
            textarea.focus();
        }

        if (moveCaretToEnd && typeof textarea.setSelectionRange === 'function') {
            var caret = String(textarea.value || '').length;
            textarea.setSelectionRange(caret, caret);
        }
    }

    function safeLocalGet(key) {
        if (!window.localStorage) {
            return null;
        }
        try {
            return window.localStorage.getItem(key);
        } catch (error) {
            return null;
        }
    }

    function safeLocalSet(key, value) {
        if (!window.localStorage) {
            return;
        }
        try {
            window.localStorage.setItem(key, value);
        } catch (error) {
            /* ignore */
        }
    }

    function clampTextareaHeight(value) {
        var height = parseInt(String(value || '').replace(/[^\d]/g, ''), 10);
        if (isNaN(height)) {
            return 0;
        }
        if (height < 120) {
            height = 120;
        }
        if (height > 720) {
            height = 720;
        }
        return height;
    }

    function applyRememberedTextareaHeight(forceExpand) {
        var saved = clampTextareaHeight(safeLocalGet(heightStorageKey));
        if (!saved) {
            return;
        }
        if (!forceExpand && form.classList.contains('smartreply-collapsed')) {
            return;
        }
        form.classList.add('smartreply-user-resized');
        form.style.setProperty('--smartreply-user-height', saved + 'px');
        textarea.style.height = saved + 'px';
        lastMeasuredTextareaHeight = saved;
    }

    function rememberTextareaHeight() {
        var currentHeight = clampTextareaHeight(Math.round(textarea.offsetHeight || 0));
        if (!currentHeight || currentHeight === lastMeasuredTextareaHeight) {
            return;
        }
        lastMeasuredTextareaHeight = currentHeight;
        form.classList.add('smartreply-user-resized');
        form.style.setProperty('--smartreply-user-height', currentHeight + 'px');
        safeLocalSet(heightStorageKey, String(currentHeight));
        if (!form.classList.contains('smartreply-collapsed')) {
            textarea.style.height = currentHeight + 'px';
        }
    }

    function getMinimalSavedStatusText() {
        return config.dataset.labelDraftAvailable || config.dataset.labelDraftReopen || config.dataset.labelSaved || 'Saved draft';
    }

    function refreshTooltips() {
        var textareaHint = shortcutsHintText;
        if (textareaHint) {
            textarea.setAttribute('title', textareaHint);
        }
        if (previewToggle) {
            var previewLabel = previewVisible ? (config.dataset.labelHidePreview || 'Hide preview') : (config.dataset.labelShowPreview || 'Show preview');
            previewToggle.setAttribute('title', previewLabel + ' (Ctrl/Cmd+Shift+P)');
            previewToggle.setAttribute('aria-label', previewLabel + ' (Ctrl/Cmd+Shift+P)');
        }
        if (clearMessageBtn) {
            clearMessageBtn.setAttribute('title', config.dataset.labelClearMessage || 'Clear message');
        }
        if (reopenDraftBtn) {
            reopenDraftBtn.setAttribute('title', config.dataset.labelDraftReopen || 'Saved draft');
        }
        if (fullEditorLink) {
            fullEditorLink.setAttribute('title', config.dataset.labelFullEditor || 'Open full editor');
        }
        if (submitBtn) {
            var submitText = submitBtn.textContent || submitBtn.value || 'Send';
            submitBtn.setAttribute('title', String(submitText).trim() + ' (Ctrl/Cmd+Enter)');
        }
    }

    function animateContextBox() {
        contextBox.classList.remove('smartreply-context-reveal');
        void contextBox.offsetWidth;
        contextBox.classList.add('smartreply-context-reveal');
        window.setTimeout(function () {
            contextBox.classList.remove('smartreply-context-reveal');
        }, prefersReducedMotion ? 80 : 260);
    }

    function syncFormContextMode(mode, hasContext) {
        form.classList.remove('smartreply-context-active-reply', 'smartreply-context-active-quote', 'smartreply-context-active-mention');
        if (!hasContext) {
            return;
        }
        form.classList.add('smartreply-context-active-' + mode);
    }

    function scrollComposerIntoView(block) {
        var target = contextBox && !contextBox.hidden ? contextBox : textarea;
        var behavior = prefersReducedMotion ? 'auto' : 'smooth';
        var scrollBlock = block || 'center';

        if (target && typeof target.scrollIntoView === 'function') {
            target.scrollIntoView({ behavior: behavior, block: scrollBlock, inline: 'nearest' });
            return;
        }

        if (textarea && typeof textarea.scrollIntoView === 'function') {
            textarea.scrollIntoView({ behavior: behavior, block: scrollBlock, inline: 'nearest' });
        }
    }

    function guideUserToComposer(options) {
        var settings = options || {};
        var delay = prefersReducedMotion ? 0 : (typeof settings.focusDelay === 'number' ? settings.focusDelay : 160);

        expandComposer(true);
        scrollComposerIntoView(settings.block || 'center');
        form.classList.remove('smartreply-scroll-focus');
        void form.offsetWidth;
        form.classList.add('smartreply-scroll-focus');
        window.setTimeout(function () {
            form.classList.remove('smartreply-scroll-focus');
        }, prefersReducedMotion ? 350 : 900);

        window.setTimeout(function () {
            focusTextarea(settings.moveCaretToEnd !== false);
        }, delay);
    }

    var removeLabel = config.dataset.labelRemove || 'Cancel reply to post';
    var jumpLabel = config.dataset.labelJumpToPost || 'Go to post';
    var jumpTitle = config.dataset.labelJumpToPostTitle || jumpLabel;
    jumpBtn.innerHTML = '<i class="icon fa-location-arrow fa-fw" aria-hidden="true"></i><span class="smartreply-context-jump-label">' + escapeHtml(jumpLabel) + '</span>';
    jumpBtn.setAttribute('title', jumpTitle);
    jumpBtn.setAttribute('aria-label', jumpTitle);
    removeBtn.innerHTML = '<i class="icon fa-times fa-fw" aria-hidden="true"></i><span class="smartreply-context-remove-label">' + escapeHtml(removeLabel) + '</span>';
    removeBtn.setAttribute('title', removeLabel + ' (Esc)');
    removeBtn.setAttribute('aria-label', removeLabel + ' (Esc)');
    restoreBtn.textContent = config.dataset.labelRestore || 'Restore';
    laterBtn.textContent = config.dataset.labelDraftLater || 'Not now';
    discardBtn.textContent = config.dataset.labelDiscard || 'Discard';
    clearMessageBtn.textContent = config.dataset.labelClearMessage || 'Clear message';
    reopenDraftBtn.textContent = config.dataset.labelDraftReopen || 'Saved draft';
    if (fullEditorLink) {
        fullEditorLink.textContent = config.dataset.labelFullEditor || 'Open full editor';
        fullEditorLink.href = fullEditorUrl;
    }
    saveStatus.textContent = config.dataset.labelReady || '';
    templateTitle.textContent = config.dataset.labelQuickTemplates || 'Quick templates';
    toolbarTitle.textContent = '';
    toolbarTitle.hidden = true;
    colorTitle.textContent = config.dataset.labelColorPalette || (config.dataset.labelColor || 'Color');
    smiliesTitle.textContent = config.dataset.labelSmilies || 'Smilies';
    smiliesEmpty.textContent = config.dataset.labelSmiliesEmpty || 'No smilies are available for quick reply.';
    previewTitle.textContent = config.dataset.labelPreview || 'Preview';
    previewToggle.textContent = config.dataset.labelShowPreview || 'Show preview';
    var shortcutsHintText = config.dataset.labelShortcutsHint || 'Ctrl/Cmd+B Bold · Ctrl/Cmd+I Italic · Ctrl/Cmd+U Underline · Ctrl/Cmd+Shift+M Mention · Ctrl/Cmd+Shift+P Preview · Ctrl/Cmd+Enter Send · Esc Cancel reply to post';
    mentionTitle.textContent = config.dataset.labelMentionsTitle || 'Topic participants';
    mentionEmpty.textContent = config.dataset.labelMentionsEmpty || 'No topic participants found for this mention.';
    refreshTooltips();

    function expandComposer(force) {
        if (force || autoExpand) {
            form.classList.remove('smartreply-collapsed');
            form.classList.add('smartreply-expanded');
            applyRememberedTextareaHeight(true);
        }
    }

    function resolvePostIndexFromId(postId) {
        var normalizedId = String(postId || '').trim();
        if (!normalizedId) {
            return '';
        }
        var postElement = document.getElementById('p' + normalizedId);
        var allPosts = document.querySelectorAll('.post[id^="p"]');
        if (!postElement || !allPosts.length) {
            return '';
        }
        for (var i = 0; i < allPosts.length; i++) {
            if (allPosts[i] === postElement) {
                return String(i + 1);
            }
        }
        return '';
    }

    function getContextMode() {
        var mode = contextMode && contextMode.value ? String(contextMode.value).trim().toLowerCase() : '';
        return (mode === 'quote' || mode === 'mention') ? mode : 'reply';
    }

    function getContextLabelParts(mode, hasPostIndex) {
        if (mode === 'quote') {
            return {
                label: hasPostIndex ? (config.dataset.labelQuotingPost || 'Quoting post') : (config.dataset.labelQuoting || 'Quoting'),
                icon: 'fa-commenting-o',
                modeClass: 'smartreply-context-mode-quote',
                iconClass: 'smartreply-context-icon-quote'
            };
        }

        if (mode === 'mention') {
            return {
                label: hasPostIndex ? (config.dataset.labelMentioningPost || 'Mentioning post') : (config.dataset.labelMentioning || 'Mentioning'),
                icon: 'fa-at',
                modeClass: 'smartreply-context-mode-mention',
                iconClass: 'smartreply-context-icon-mention'
            };
        }

        return {
            label: hasPostIndex ? (config.dataset.labelContextPost || 'Replying to post') : (config.dataset.labelContext || 'Replying to'),
            icon: 'fa-reply',
            modeClass: 'smartreply-context-mode-reply',
            iconClass: 'smartreply-context-icon-reply'
        };
    }

    function updateContextVisualMode(mode, hasPostIndex) {
        var parts = getContextLabelParts(mode, hasPostIndex);
        contextBox.classList.remove('smartreply-context-mode-reply', 'smartreply-context-mode-quote', 'smartreply-context-mode-mention');
        contextBox.classList.add(parts.modeClass);
        contextIconEl.classList.remove('smartreply-context-icon-reply', 'smartreply-context-icon-quote', 'smartreply-context-icon-mention');
        contextIconEl.classList.add(parts.iconClass);
        contextIconEl.innerHTML = '<i class="icon ' + parts.icon + ' fa-fw"></i>';
    }

    function buildStatePill(text, className, title) {
        if (!text) {
            return '';
        }
        var safeClass = className ? ' ' + className : '';
        var safeTitle = title ? ' title="' + escapeHtml(title) + '"' : '';
        return '<span class="smartreply-state-pill' + safeClass + '"' + safeTitle + '>' + escapeHtml(text) + '</span>';
    }

    function buildContextLine(username, postIndex) {
        var safeUsername = String(username || '').trim();
        var safePostIndex = String(postIndex || '').trim();
        var parts = getContextLabelParts(getContextMode(), !!safePostIndex);
        if (safePostIndex && safeUsername) {
            return parts.label + ' #' + safePostIndex + ' ' + (config.dataset.labelContextBy || 'by') + ' ' + safeUsername;
        }
        if (safePostIndex) {
            return parts.label + ' #' + safePostIndex;
        }
        if (safeUsername) {
            return parts.label + ' ' + safeUsername;
        }
        return '';
    }

    function resolvePostFromButton(button) {
        if (!button) {
            return null;
        }
        var byClosest = typeof button.closest === 'function' ? button.closest('.post') : null;
        if (byClosest) {
            return byClosest;
        }
        var postId = button.dataset && button.dataset.postId ? String(button.dataset.postId).trim() : '';
        if (postId) {
            return document.getElementById('p' + postId);
        }
        return null;
    }

    function sanitizeCssColor(value) {
        var color = value ? String(value).trim() : '';
        if (!color) {
            return '';
        }
        if (/^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(color)) {
            return color;
        }
        if (/^[0-9a-f]{3}([0-9a-f]{3})?$/i.test(color)) {
            return '#' + color;
        }
        if (/^(?:rgb|rgba|hsl|hsla)\([0-9.,%\s-]+\)$/i.test(color)) {
            return color;
        }
        return '';
    }

    function resolveUserColourFromButton(button) {
        var color = button && button.dataset && button.dataset.userColour ? sanitizeCssColor(button.dataset.userColour) : '';
        if (color) {
            return color;
        }
        var postElement = resolvePostFromButton(button);
        if (!postElement) {
            return '';
        }
        var authorEl = postElement.querySelector('.author strong a, .author strong, a.username-coloured, a.username, span.username-coloured, span.username, .username-coloured, .username');
        if (!authorEl) {
            return '';
        }
        color = sanitizeCssColor(authorEl.style && authorEl.style.color ? authorEl.style.color : '');
        if (color) {
            return color;
        }
        if (window.getComputedStyle) {
            color = sanitizeCssColor(window.getComputedStyle(authorEl).color || '');
            if (color) {
                return color;
            }
        }
        return '';
    }

    function resolveUsernameFromButton(button) {
        var username = button && button.dataset && button.dataset.username ? String(button.dataset.username).trim() : '';
        if (username) {
            return username;
        }
        var postElement = resolvePostFromButton(button);
        if (!postElement) {
            return '';
        }
        var authorEl = postElement.querySelector('.author strong a, .author strong, a.username-coloured, a.username, span.username-coloured, span.username, .username-coloured, .username');
        if (!authorEl) {
            return '';
        }
        return String(authorEl.textContent || '').replace(/\s+/g, ' ').trim();
    }

    function buildContextLineMarkup(postId, username, postIndex, userColour) {
        var safeUsername = String(username || '').trim();
        var safePostIndex = String(postIndex || '').trim();
        var parts = getContextLabelParts(getContextMode(), !!safePostIndex);
        var safeUserColour = sanitizeCssColor(userColour);
        var usernameStyle = safeUserColour ? ' style="color: ' + escapeHtml(safeUserColour) + ';"' : '';
        var postHref = postId ? '#p' + String(postId).trim() : '';
        var jumpTitle = escapeHtml(config.dataset.labelJumpToPostTitle || config.dataset.labelJumpToPost || 'Go to post');
        var postLink = safePostIndex
            ? (postHref
                ? '<a class="smartreply-context-post-link" href="' + escapeHtml(postHref) + '" data-post-id="' + escapeHtml(postId) + '" title="' + jumpTitle + '" aria-label="' + jumpTitle + '">#' + escapeHtml(safePostIndex) + '</a>'
                : '<span class="smartreply-context-post-index">#' + escapeHtml(safePostIndex) + '</span>')
            : '';
        var usernameMarkup = safeUsername
            ? (postHref
                ? '<a class="smartreply-context-username smartreply-context-user-link" href="' + escapeHtml(postHref) + '" data-post-id="' + escapeHtml(postId) + '" title="' + jumpTitle + '" aria-label="' + jumpTitle + '"' + usernameStyle + '>' + escapeHtml(safeUsername) + '</a>'
                : '<span class="smartreply-context-username"' + usernameStyle + '>' + escapeHtml(safeUsername) + '</span>')
            : '';

        if (safeUsername && safePostIndex) {
            return escapeHtml(parts.label) + ' ' + postLink + ' ' +
                escapeHtml(config.dataset.labelContextBy || 'by') + ' ' + usernameMarkup;
        }
        if (safePostIndex) {
            return escapeHtml(parts.label) + ' ' + postLink;
        }
        if (safeUsername) {
            return escapeHtml(parts.label) + ' ' + usernameMarkup;
        }
        return '';
    }

    var activeOriginPost = null;
    var originPulseTimer = 0;
    var originFocusTimer = 0;

    function syncActivePostActionButtons() {
        var activePostId = contextPostId ? String(contextPostId.value || '').trim() : '';
        var activeMode = getContextMode();

        document.querySelectorAll('.smartreply-post-reply-btn').forEach(function (button) {
            var isSamePost = !!activePostId && String(button.dataset.postId || '').trim() === activePostId;
            var isActive = false;

            button.classList.toggle('smartreply-action-on-context-post', isSamePost);

            if (isSamePost) {
                if (activeMode === 'quote') {
                    isActive = button.classList.contains('smartreply-action-quote');
                } else if (activeMode === 'mention') {
                    isActive = button.classList.contains('smartreply-action-mention');
                } else {
                    isActive = button.classList.contains('smartreply-action-reply');
                }
            }

            button.classList.toggle('is-active', isActive);
            button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        });
    }

    function getPostElementById(postId) {
        if (!postId) {
            return null;
        }
        return document.getElementById('p' + String(postId).trim());
    }

    function clearOriginFocus() {
        if (originFocusTimer) {
            window.clearTimeout(originFocusTimer);
            originFocusTimer = 0;
        }
        document.querySelectorAll('.smartreply-origin-focus[data-smartreply-temp-focus="1"]').forEach(function (element) {
            element.classList.remove('smartreply-origin-focus');
            if (element.getAttribute('tabindex') === '-1') {
                element.removeAttribute('tabindex');
            }
            element.removeAttribute('data-smartreply-temp-focus');
        });
    }

    function clearOriginHighlight() {
        if (originPulseTimer) {
            window.clearTimeout(originPulseTimer);
            originPulseTimer = 0;
        }
        clearOriginFocus();
        if (activeOriginPost) {
            activeOriginPost.classList.remove('smartreply-origin-post');
            activeOriginPost.classList.remove('smartreply-origin-pulse');
            activeOriginPost = null;
        }
    }

    function syncOriginHighlight(postId) {
        var nextPost = getPostElementById(postId);
        if (activeOriginPost && activeOriginPost !== nextPost) {
            activeOriginPost.classList.remove('smartreply-origin-post');
            activeOriginPost.classList.remove('smartreply-origin-pulse');
        }
        activeOriginPost = nextPost;
        if (activeOriginPost) {
            activeOriginPost.classList.add('smartreply-origin-post');
        }
    }

    function focusOriginPost(postElement) {
        if (!postElement) {
            return;
        }
        clearOriginFocus();
        postElement.classList.add('smartreply-origin-focus');
        postElement.setAttribute('data-smartreply-temp-focus', '1');
        if (!postElement.hasAttribute('tabindex')) {
            postElement.setAttribute('tabindex', '-1');
        }
        try {
            postElement.focus({ preventScroll: true });
        } catch (error) {
            postElement.focus();
        }
        originFocusTimer = window.setTimeout(function () {
            if (!postElement) {
                return;
            }
            postElement.classList.remove('smartreply-origin-focus');
            if (postElement.getAttribute('data-smartreply-temp-focus') === '1') {
                if (postElement.getAttribute('tabindex') === '-1') {
                    postElement.removeAttribute('tabindex');
                }
                postElement.removeAttribute('data-smartreply-temp-focus');
            }
            originFocusTimer = 0;
        }, prefersReducedMotion ? 1200 : 1800);
    }

    function pulseOriginPost(postId, shouldScroll) {
        var postElement = getPostElementById(postId);
        if (!postElement) {
            return;
        }
        syncOriginHighlight(postId);
        postElement.classList.remove('smartreply-origin-pulse');
        void postElement.offsetWidth;
        postElement.classList.add('smartreply-origin-pulse');
        if (shouldScroll && typeof postElement.scrollIntoView === 'function') {
            postElement.scrollIntoView({behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'center', inline: 'nearest'});
            window.setTimeout(function () {
                focusOriginPost(postElement);
            }, prefersReducedMotion ? 0 : 170);
        }
        if (originPulseTimer) {
            window.clearTimeout(originPulseTimer);
        }
        originPulseTimer = window.setTimeout(function () {
            postElement.classList.remove('smartreply-origin-pulse');
            originPulseTimer = 0;
        }, 1800);
    }

    function renderStateBar() {
        if (!stateBar) {
            return;
        }

        var pills = [];
        var username = contextUsername ? String(contextUsername.value || '').trim() : '';
        var postIndex = contextPostIndex ? String(contextPostIndex.value || '').trim() : '';
        var hasContext = !!(username || postIndex);
        var payload = readSavedDraft();
        var hasDraft = !!(payload && (payload.message || payload.context_username));

        if (autosaveEnabled) {
            pills.push(buildStatePill(config.dataset.labelAutosaveOn || 'Autosave on', 'smartreply-state-pill-autosave'));
        }

        if (hasContext) {
            var mode = getContextMode();
            var parts = getContextLabelParts(mode, !!postIndex);
            var summary = buildContextLine(username, postIndex) || parts.label;
            pills.push(buildStatePill(parts.label, 'smartreply-state-pill-mode smartreply-state-pill-mode-' + mode, summary));
            if (postIndex) {
                pills.push(buildStatePill('#' + postIndex, 'smartreply-state-pill-post', summary));
            }
            if (username) {
                pills.push(buildStatePill(username, 'smartreply-state-pill-user', summary));
            }
        }

        if (hasDraft) {
            pills.push(buildStatePill(config.dataset.labelDraftAvailable || config.dataset.labelDraftReopen || 'Saved draft', 'smartreply-state-pill-draft'));
        }

        if (!hasContext && !hasDraft) {
            pills.push(buildStatePill(config.dataset.labelReadyCompact || config.dataset.labelReady || 'Ready', 'smartreply-state-pill-ready'));
        }

        stateBar.innerHTML = pills.join('');
        stateBar.hidden = !pills.length;
    }

    function updateContextBox() {
        var username = contextUsername ? contextUsername.value.trim() : '';
        var postId = contextPostId ? contextPostId.value.trim() : '';
        var postIndex = contextPostIndex ? contextPostIndex.value.trim() : '';
        var subject = contextSubject ? contextSubject.value.trim() : '';
        var snippet = contextSnippet ? contextSnippet.value.trim() : '';
        var userColour = contextUserColour ? contextUserColour.value.trim() : '';
        var mode = getContextMode();
        var contextLine = buildContextLine(username, postIndex);
        var contextMarkup = buildContextLineMarkup(postId, username, postIndex, userColour);
        var hasContext = !!(username || postIndex);

        form.classList.toggle('smartreply-has-context', hasContext);
        syncFormContextMode(mode, hasContext);
        updateContextVisualMode(mode, !!postIndex);

        if (!hasContext) {
            contextBox.hidden = true;
            contextBox.removeAttribute('data-context-line');
            lineEl.removeAttribute('data-context-line');
            lineEl.innerHTML = '';
            jumpBtn.hidden = true;
            textarea.setAttribute('placeholder', originalTextareaPlaceholder);
            clearOriginHighlight();
            syncActivePostActionButtons();
            renderStateBar();
            refreshTooltips();
            return;
        }

        lineEl.innerHTML = contextMarkup;
        lineEl.setAttribute('title', contextLine);
        lineEl.setAttribute('data-context-line', contextLine);
        contextBox.setAttribute('data-context-line', contextLine);
        subEl.textContent = subject ? subject : '';
        subEl.hidden = !subject;
        if (subject) {
            subEl.setAttribute('title', subject);
        } else {
            subEl.removeAttribute('title');
        }
        snippetEl.textContent = showSnippet && snippet ? snippet : '';
        snippetEl.hidden = !(showSnippet && snippet);
        if (showSnippet && snippet) {
            snippetEl.setAttribute('title', snippet);
        } else {
            snippetEl.removeAttribute('title');
        }
        jumpBtn.hidden = !postId;
        textarea.setAttribute('placeholder', contextLine ? (contextLine + '…') : originalTextareaPlaceholder);
        contextBox.hidden = false;
        animateContextBox();
        syncOriginHighlight(postId);
        syncActivePostActionButtons();
        renderStateBar();
        refreshTooltips();
    }

    function clearContext() {
        var previousUsername = contextUsername ? String(contextUsername.value || '').trim() : '';
        var previousPostIndex = contextPostIndex ? String(contextPostIndex.value || '').trim() : '';
        if (contextPostId) { contextPostId.value = ''; }
        if (contextPostIndex) { contextPostIndex.value = ''; }
        if (contextUsername) { contextUsername.value = ''; }
        if (contextUserColour) { contextUserColour.value = ''; }
        if (contextSubject) { contextSubject.value = ''; }
        if (contextSnippet) { contextSnippet.value = ''; }
        if (contextMode) { contextMode.value = 'reply'; }

        if (previousUsername) {
            var escapedUsername = previousUsername.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            var escapedIndex = previousPostIndex ? previousPostIndex.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : '';
            var notePostLabel = (config.dataset.labelContextNotePost || 'Replying to post').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            var noteByLabel = (config.dataset.labelContextBy || 'by').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            var noteSimpleLabel = (config.dataset.labelContextNote || 'Replying to').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            var notePattern = escapedIndex
                ? new RegExp('^(?:\\[size=85\\]\\[i\\]' + notePostLabel + '\\s+#' + escapedIndex + '\\s+' + noteByLabel + '\\s+' + escapedUsername + '\\[/i\\]\\[/size\\]\\n\\n)+', 'i')
                : new RegExp('^(?:\\[size=85\\]\\[i\\]' + noteSimpleLabel + '\\s+' + escapedUsername + '\\[/i\\]\\[/size\\]\\n\\n)+', 'i');
            textarea.value = String(textarea.value || '').replace(notePattern, '');
        }

        updateContextBox();
        clearOriginHighlight();
        hideMentionBox();
        guideUserToComposer({ block: 'nearest' });
        updatePreview();
        persistDraft();
    }

    function jumpToOriginPost() {
        var postId = contextPostId ? String(contextPostId.value || '').trim() : '';
        if (!postId) {
            return;
        }
        pulseOriginPost(postId, true);
    }

    function clearMessage() {
        textarea.value = '';
        hideMentionBox();
        hideColorPalette();
        hideSmilies();
        expandComposer(true);
        textarea.focus();
        updatePreview();
        persistDraft();
    }

    function applyContext(data) {
        if (contextPostId) { contextPostId.value = data.postId || ''; }
        if (contextPostIndex) { contextPostIndex.value = data.postIndex || resolvePostIndexFromId(data.postId || ''); }
        if (contextUsername) { contextUsername.value = data.username || ''; }
        if (contextUserColour) { contextUserColour.value = data.userColour || ''; }
        if (contextSubject) { contextSubject.value = data.subject || ''; }
        if (contextSnippet) { contextSnippet.value = data.snippet || ''; }
        if (contextMode) { contextMode.value = data.mode || 'reply'; }
        updateContextBox();
        pulseOriginPost(data.postId || '', false);
        updatePreview();
        guideUserToComposer({ block: 'center' });
        form.classList.add('smartreply-flash');
        window.setTimeout(function () { form.classList.remove('smartreply-flash'); }, 1200);
        persistDraft();
    }

    function replacePlaceholders(message) {
        var username = contextUsername && contextUsername.value ? contextUsername.value : '';
        var subject = contextSubject && contextSubject.value ? contextSubject.value : '';

        return String(message || '')
            .replace(/\n/g, '\n')
            .replace(/\{newline\}/g, '\n')
            .replace(/\{username\}/g, username)
            .replace(/\{subject\}/g, subject);
    }

    function insertAtCursor(value) {
        var text = replacePlaceholders(value);
        var start = textarea.selectionStart || 0;
        var end = textarea.selectionEnd || 0;
        var current = textarea.value || '';
        var before = current.substring(0, start);
        var after = current.substring(end);
        var needsSpacingBefore = before.length && !/\s$/.test(before);
        var needsSpacingAfter = after.length && !/^\s/.test(after);
        var insert = text;

        if (needsSpacingBefore) {
            insert = '\n\n' + insert;
        }
        if (needsSpacingAfter) {
            insert = insert + '\n\n';
        }

        textarea.value = before + insert + after;
        var caret = before.length + insert.length;
        if (typeof textarea.setSelectionRange === 'function') {
            textarea.setSelectionRange(caret, caret);
        }
        expandComposer(true);
        textarea.focus();
        updatePreview();
        persistDraft();
    }

    function extractSelectedTextForPost(postId) {
        if (!window.getSelection) {
            return '';
        }

        var selection = window.getSelection();
        if (!selection || selection.rangeCount < 1 || selection.isCollapsed) {
            return '';
        }

        var text = String(selection.toString() || '').replace(/\s+/g, ' ').trim();
        if (!text) {
            return '';
        }

        var container = selection.getRangeAt(0).commonAncestorContainer;
        var element = container && container.nodeType === 1 ? container : (container ? container.parentElement : null);
        var post = document.getElementById('p' + postId);

        if (post && element && !post.contains(element)) {
            return '';
        }

        if (text.length > 500) {
            text = text.substring(0, 497).trim() + '...';
        }

        return text;
    }

    function insertQuickQuote(data) {
        var username = data && data.username ? data.username : '';
        var snippet = extractSelectedTextForPost(data.postId || '') || (data && data.snippet ? data.snippet : '');
        snippet = String(snippet || '').replace(/\r\n?/g, '\n').trim();

        if (!snippet) {
            snippet = config.dataset.labelQuoteDefault || 'Quoted text';
        }

        var authorPart = username ? '="' + username.replace(/"/g, "'") + '"' : '';
        insertAtCursor('[quote' + authorPart + ']' + snippet + '[/quote]');
        applyContext(Object.assign({ mode: 'quote' }, data || {}));
        updatePreview(true);
    }


    function insertLightMention(data) {
        var username = data && data.username ? String(data.username).trim() : '';
        var userColour = data && data.userColour ? data.userColour : '';
        if (!username) {
            insertAtCursor('@');
            return;
        }
        insertAtCursor(buildMentionMarkup(username, userColour));
        applyContext(Object.assign({ mode: 'mention' }, data || {}));
    }

    function normalizeUserColour(value) {
        var color = value ? String(value).trim() : '';
        if (!color) {
            return '';
        }
        if (color.charAt(0) !== '#') {
            color = '#' + color;
        }
        return /^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(color) ? color : '';
    }


    function buildMentionMarkup(username, color) {
        var safeUsername = String(username || '').trim();
        if (!safeUsername) {
            return '@';
        }
        var safeColor = normalizeUserColour(color);
        if (safeColor) {
            return '[color=' + safeColor + ']@' + safeUsername + '[/color]';
        }
        return '@' + safeUsername;
    }

    function collectTopicParticipants() {
        var seen = {};
        var users = [];
        document.querySelectorAll('.smartreply-trigger, .smartreply-quote-trigger, .smartreply-mention-trigger').forEach(function (button) {
            var username = button.dataset && button.dataset.username ? String(button.dataset.username).trim() : '';
            var color = button.dataset && button.dataset.userColour ? normalizeUserColour(button.dataset.userColour) : '';
            var key = username.toLowerCase();
            if (!username || seen[key]) {
                return;
            }
            seen[key] = true;
            users.push({ username: username, color: color });
        });
        return users.sort(function (a, b) {
            return a.username.localeCompare(b.username);
        });
    }

    function parseSmilies() {
        var node = document.getElementById('smartreply-smilies-data');
        if (!node) {
            return [];
        }
        try {
            var parsed = JSON.parse(node.textContent || '[]');
            if (!Array.isArray(parsed)) {
                return [];
            }
            var seenCodes = Object.create(null);
            var seenUrls = Object.create(null);
            return parsed.filter(function (entry) {
                var codeKey;
                var urlKey;

                if (!entry || !entry.code || !entry.url) {
                    return false;
                }

                codeKey = String(entry.code).toLowerCase();
                urlKey = String(entry.url).toLowerCase();

                if (seenCodes[codeKey] || seenUrls[urlKey]) {
                    return false;
                }

                seenCodes[codeKey] = true;
                seenUrls[urlKey] = true;
                return true;
            });
        } catch (e) {
            return [];
        }
    }

    function hideSmilies() {
        smiliesBox.hidden = true;
        toolbarBox.classList.remove('smartreply-smilies-open');
        editorGrid.classList.remove('smartreply-editor-grid-smilies-open');
    }

    function insertSmiley(code) {
        if (!code) {
            return;
        }

        var start = textarea.selectionStart || 0;
        var end = textarea.selectionEnd || 0;
        var current = textarea.value || '';
        var before = current.substring(0, start);
        var after = current.substring(end);
        var needsSpacingBefore = before.length && !/\s$/.test(before);
        var needsSpacingAfter = after.length && !/^\s/.test(after);
        var insert = code;

        if (needsSpacingBefore) {
            insert = ' ' + insert;
        }
        if (needsSpacingAfter) {
            insert = insert + ' ';
        }

        textarea.value = before + insert + after;

        var caret = before.length + insert.length;
        if (typeof textarea.setSelectionRange === 'function') {
            textarea.setSelectionRange(caret, caret);
        }

        expandComposer(true);
        textarea.focus();
        updatePreview();
        persistDraft();
        hideSmilies();
    }

    function renderSmilies() {
        smiliesList.innerHTML = '';
        smiliesEmpty.hidden = smilies.length > 0;

        smilies.forEach(function (entry) {
            var button = document.createElement('button');
            var label = entry.emotion || entry.code;
            var width = parseInt(entry.width, 10) || 0;
            var height = parseInt(entry.height, 10) || 0;
            var sizeAttrs = '';

            if (width > 0) {
                sizeAttrs += ' width="' + width + '"';
            }
            if (height > 0) {
                sizeAttrs += ' height="' + height + '"';
            }

            button.type = 'button';
            button.className = 'button button-icon-only smartreply-btn smartreply-smiley-option';
            button.setAttribute('title', label + ' ' + entry.code);
            button.setAttribute('aria-label', label + ' ' + entry.code);
            button.innerHTML = '<img src="' + escapeHtml(entry.url) + '" alt="' + escapeHtml(entry.code) + '"' + sizeAttrs + ' loading="lazy">';
            button.addEventListener('click', function () {
                insertSmiley(entry.code);
            });
            smiliesList.appendChild(button);
        });
    }

    function toggleSmilies() {
        var willOpen = smiliesBox.hidden;
        if (!willOpen) {
            hideSmilies();
            return;
        }
        hideColorPalette();
        renderSmilies();
        smiliesBox.hidden = false;
        toolbarBox.classList.add('smartreply-smilies-open');
        editorGrid.classList.add('smartreply-editor-grid-smilies-open');
    }

    function hideMentionBox() {
        mentionState.active = false;
        mentionState.items = [];
        mentionBox.hidden = true;
        mentionList.innerHTML = '';
        form.classList.remove('smartreply-mention-open');
    }

    function renderMentionBox() {
        mentionList.innerHTML = '';
        mentionEmpty.hidden = mentionState.items.length > 0;

        mentionState.items.forEach(function (item, index) {
            var button = document.createElement('button');
            var username = item && item.username ? item.username : '';
            var color = item && item.color ? item.color : '';
            var nameHtml = '<span class="smartreply-mention-prefix" aria-hidden="true">@</span>' +
                '<span class="smartreply-mention-name"' + (color ? ' style="color: ' + color + ';"' : '') + '>' + escapeHtml(username) + '</span>';

            button.type = 'button';
            button.className = 'smartreply-btn smartreply-mention-option';
            if (index === mentionState.index) {
                button.className += ' smartreply-mention-option-active';
            }
            button.innerHTML = nameHtml + '<span class="smartreply-sr-only">@' + escapeHtml(username) + '</span>';
            button.setAttribute('data-username', username);
            if (color) {
                button.setAttribute('data-user-colour', color);
            }
            button.addEventListener('mousedown', function (event) {
                event.preventDefault();
                applyMentionSelection(username);
            });
            mentionList.appendChild(button);
        });

        mentionBox.hidden = false;
        form.classList.add('smartreply-mention-open');
    }

    function detectMentionQuery() {
        if ((textarea.selectionStart || 0) !== (textarea.selectionEnd || 0)) {
            hideMentionBox();
            return;
        }

        var caret = textarea.selectionStart || 0;
        var before = String(textarea.value || '').substring(0, caret);
        var match = before.match(/(^|[\s(\[{>])@([^\s@]{0,30})$/);
        if (!match) {
            hideMentionBox();
            return;
        }

        var query = String(match[2] || '');
        var tokenStart = caret - query.length - 1;
        var users = collectTopicParticipants();
        var lowered = query.toLowerCase();
        var starts = [];
        var contains = [];

        users.forEach(function (item) {
            var username = item && item.username ? item.username : '';
            var value = username.toLowerCase();
            if (!lowered) {
                starts.push(item);
                return;
            }
            if (value.indexOf(lowered) === 0) {
                starts.push(item);
            } else if (value.indexOf(lowered) > 0) {
                contains.push(item);
            }
        });

        mentionState.active = true;
        mentionState.start = tokenStart;
        mentionState.end = caret;
        mentionState.query = query;
        mentionState.items = starts.concat(contains).slice(0, 8);
        mentionState.index = 0;
        renderMentionBox();
    }

    function applyMentionSelection(username) {
        if (!mentionState.active) {
            return;
        }

        var current = String(textarea.value || '');
        var before = current.substring(0, mentionState.start);
        var after = current.substring(mentionState.end);
        var selectedItem = mentionState.items[mentionState.index] || {};
        var selectedColor = selectedItem && selectedItem.username === username ? selectedItem.color : '';
        if (!selectedColor) {
            mentionState.items.forEach(function (item) {
                if (item && item.username === username && item.color) {
                    selectedColor = item.color;
                }
            });
        }
        var insert = buildMentionMarkup(username, selectedColor) + ' ';
        textarea.value = before + insert + after;
        var caret = before.length + insert.length;
        if (typeof textarea.setSelectionRange === 'function') {
            textarea.setSelectionRange(caret, caret);
        }
        textarea.focus();
        hideMentionBox();
        expandComposer(true);
        updatePreview();
        persistDraft();
    }

    function handleMentionNavigation(event) {
        if (!mentionState.active) {
            return false;
        }

        var key = String(event.key || '').toLowerCase();
        if (key === 'arrowdown') {
            event.preventDefault();
            if (mentionState.items.length) {
                mentionState.index = (mentionState.index + 1) % mentionState.items.length;
                renderMentionBox();
            }
            return true;
        }

        if (key === 'arrowup') {
            event.preventDefault();
            if (mentionState.items.length) {
                mentionState.index = (mentionState.index - 1 + mentionState.items.length) % mentionState.items.length;
                renderMentionBox();
            }
            return true;
        }

        if (key === 'enter' || key === 'tab') {
            if (mentionState.items.length) {
                event.preventDefault();
                applyMentionSelection(mentionState.items[mentionState.index].username);
                return true;
            }
        }

        if (key === 'escape') {
            event.preventDefault();
            hideMentionBox();
            return true;
        }

        return false;
    }

    function wrapSelection(openTag, closeTag, placeholder) {
        var start = textarea.selectionStart || 0;
        var end = textarea.selectionEnd || 0;
        var current = textarea.value || '';
        var selected = current.substring(start, end);
        var content = selected || placeholder || '';
        var replacement = openTag + content + closeTag;
        textarea.value = current.substring(0, start) + replacement + current.substring(end);
        textarea.focus();
        if (typeof textarea.setSelectionRange === 'function') {
            if (selected) {
                textarea.setSelectionRange(start + openTag.length, start + openTag.length + selected.length);
            } else {
                textarea.setSelectionRange(start + openTag.length, start + openTag.length + content.length);
            }
        }
        expandComposer(true);
        updatePreview();
        persistDraft();
    }
    function customColorPrompt() {
        if (!customColorInput) {
            return;
        }
        customColorInput.value = '#cc0000';
        customColorInput.click();
    }

    function hideColorPalette() {
        colorPaletteBox.hidden = true;
        toolbarBox.classList.remove('smartreply-color-open');
    }

    function applyColorSelection(value) {
        hideColorPalette();
        wrapSelection('[color=' + value + ']', '[/color]', 'texto');
    }

    function buildColorPalette() {
        var colors = [
            { value: '#000000', label: 'Black' },
            { value: '#444444', label: 'Dark gray' },
            { value: '#c0392b', label: 'Red' },
            { value: '#e67e22', label: 'Orange' },
            { value: '#f1c40f', label: 'Gold' },
            { value: '#27ae60', label: 'Green' },
            { value: '#16a085', label: 'Teal' },
            { value: '#2980b9', label: 'Blue' },
            { value: '#2c3e50', label: 'Navy' },
            { value: '#8e44ad', label: 'Purple' },
            { value: '#d2527f', label: 'Pink' },
            { value: '#7f8c8d', label: 'Gray' }
        ];

        colorSwatches.innerHTML = '';
        colorActions.innerHTML = '';

        colors.forEach(function (entry) {
            var button = document.createElement('button');
            button.type = 'button';
            button.className = 'button button-icon-only smartreply-color-swatch';
            button.style.setProperty('--smartreply-color-swatch', entry.value);
            var colorLabel = (config.dataset.labelColor || 'Color') + ' ' + entry.value;
            button.setAttribute('title', colorLabel);
            button.setAttribute('aria-label', colorLabel);
            button.innerHTML = '<span class="smartreply-color-chip" aria-hidden="true"></span><span class="smartreply-sr-only">' + colorLabel + '</span>';
            button.addEventListener('click', function () {
                applyColorSelection(entry.value);
            });
            colorSwatches.appendChild(button);
        });

        var customButton = document.createElement('button');
        customButton.type = 'button';
        customButton.className = 'button smartreply-btn smartreply-color-custom-btn';
        customButton.textContent = config.dataset.labelColorCustom || 'Color picker';
        customButton.addEventListener('click', customColorPrompt);
        colorActions.appendChild(customButton);

        if (!customColorInput) {
            customColorInput = document.createElement('input');
            customColorInput.type = 'color';
            customColorInput.className = 'smartreply-color-input';
            customColorInput.value = '#cc0000';
            customColorInput.setAttribute('aria-label', config.dataset.labelColorCustom || 'Color picker');
            customColorInput.hidden = true;
            customColorInput.addEventListener('input', function () {
                if (this.value) {
                    applyColorSelection(this.value);
                }
            });
            colorActions.appendChild(customColorInput);
        }
    }

    function toggleColorPalette() {
        var willOpen = colorPaletteBox.hidden;
        if (!willOpen) {
            hideColorPalette();
            return;
        }
        hideSmilies();
        buildColorPalette();
        colorPaletteBox.hidden = false;
        toolbarBox.classList.add('smartreply-color-open');
    }

    function submitComposer() {
        expandComposer(true);
        if (typeof form.requestSubmit === 'function') {
            form.requestSubmit();
            return;
        }
        var submit = form.querySelector('[name="post"], button[type="submit"], input[type="submit"]');
        if (submit && typeof submit.click === 'function') {
            submit.click();
            return;
        }
        form.submit();
    }

    function handleTextareaShortcuts(event) {
        var key = String(event.key || '').toLowerCase();
        var mod = !!(event.ctrlKey || event.metaKey);

        if (handleMentionNavigation(event)) {
            return;
        }

        if (key === 'escape') {
            if (contextUsername && contextUsername.value) {
                event.preventDefault();
                clearContext();
            } else {
                hideMentionBox();
                hideColorPalette();
                hideSmilies();
            }
            return;
        }

        if (!mod || event.altKey) {
            return;
        }

        if (key === 'enter') {
            event.preventDefault();
            submitComposer();
            return;
        }

        if (event.shiftKey && key === 'p') {
            event.preventDefault();
            togglePreview();
            return;
        }

        if (event.shiftKey && key === 'm') {
            event.preventDefault();
            var mentionUsername = contextUsername && contextUsername.value ? contextUsername.value : '';
            if (mentionUsername) {
                insertLightMention({
                    postId: contextPostId ? contextPostId.value : '',
                    username: mentionUsername,
                    subject: contextSubject ? contextSubject.value : '',
                    snippet: contextSnippet ? contextSnippet.value : ''
                });
            } else {
                insertAtCursor('@');
            }
            return;
        }

        if (event.shiftKey && key === 'q') {
            event.preventDefault();
            wrapSelection('[quote]', '[/quote]', 'texto');
            return;
        }

        if (key === 'b') {
            event.preventDefault();
            wrapSelection('[b]', '[/b]', 'texto');
            return;
        }

        if (key === 'i') {
            event.preventDefault();
            wrapSelection('[i]', '[/i]', 'texto');
            return;
        }

        if (key === 'u') {
            event.preventDefault();
            wrapSelection('[u]', '[/u]', 'texto');
            return;
        }

        if (key === 'k') {
            event.preventDefault();
            wrapSelection('[url]', '[/url]', 'https://');
        }
    }

    function updateToolbarState() {
        var extras = toolbarActions.querySelectorAll('.smartreply-toolbar-extra');
        extras.forEach(function (button) {
            button.hidden = compactToolbar && !toolbarExpanded;
        });

        if (toolbarToggle) {
            toolbarToggle.textContent = toolbarExpanded ? (config.dataset.labelHideTools || 'Hide tools') : (config.dataset.labelMoreTools || 'More tools');
            toolbarToggle.setAttribute('aria-expanded', toolbarExpanded ? 'true' : 'false');
        }

        toolbarBox.classList.toggle('smartreply-toolbar-compact', compactToolbar);
        toolbarBox.classList.toggle('smartreply-toolbar-tools-open', toolbarExpanded);
        refreshTooltips();
    }

    function iconHtml(entry) {
        if (entry.fa) {
            return '<i class="icon ' + entry.fa + ' fa-fw smartreply-fa-icon" aria-hidden="true"></i>' +
                '<span class="smartreply-sr-only">' + entry.label + '</span>' ;
        }
        return '<span class="smartreply-icon' + (entry.textClass ? ' ' + entry.textClass : '') + '" aria-hidden="true">' + entry.icon + '</span>' +
            '<span class="smartreply-sr-only">' + entry.label + '</span>' ;
    }

    function buildToolbar() {
        var buttons = [
            { label: config.dataset.labelBold || 'Bold', fa: 'fa-bold', action: function () { wrapSelection('[b]', '[/b]', 'texto'); }, primary: true },
            { label: config.dataset.labelItalic || 'Italic', fa: 'fa-italic', action: function () { wrapSelection('[i]', '[/i]', 'texto'); }, primary: true },
            { label: config.dataset.labelUnderline || 'Underline', fa: 'fa-underline', action: function () { wrapSelection('[u]', '[/u]', 'texto'); }, primary: true },
            { label: config.dataset.labelQuote || 'Quote', fa: 'fa-quote-left', action: function () { wrapSelection('[quote]', '[/quote]', 'texto'); }, primary: true },
            { label: config.dataset.labelCode || 'Code', fa: 'fa-code', action: function () { wrapSelection('[code]', '[/code]', 'código'); } },
            { label: config.dataset.labelUrl || 'URL', fa: 'fa-link', action: function () { wrapSelection('[url]', '[/url]', 'https://'); } },
            { label: config.dataset.labelList || 'List', fa: 'fa-list-ul', action: function () { insertAtCursor('[list]\n[*] Item 1\n[*] Item 2\n[/list]'); } },
            { label: config.dataset.labelColor || 'Color', fa: 'fa-tint', action: toggleColorPalette },
            { label: config.dataset.labelSmilies || 'Smilies', fa: 'fa-smile-o', action: toggleSmilies },
            { label: config.dataset.labelMention || 'Mention', fa: 'fa-at', action: function () { insertAtCursor('@'); detectMentionQuery(); } }
        ];

        toolbarActions.innerHTML = '';
        buttons.forEach(function (entry) {
            var button = document.createElement('button');
            button.type = 'button';
            button.className = 'button button-icon-only smartreply-btn smartreply-toolbar-btn smartreply-toolbar-icon-btn';
            if (!entry.primary) {
                button.className += ' smartreply-toolbar-extra';
            }
            var shortcutHint = '';
            if (entry.fa === 'fa-bold') {
                shortcutHint = ' (Ctrl/Cmd+B)';
            } else if (entry.fa === 'fa-italic') {
                shortcutHint = ' (Ctrl/Cmd+I)';
            } else if (entry.fa === 'fa-underline') {
                shortcutHint = ' (Ctrl/Cmd+U)';
            } else if (entry.fa === 'fa-link') {
                shortcutHint = ' (Ctrl/Cmd+K)';
            } else if (entry.fa === 'fa-at') {
                shortcutHint = ' (Ctrl/Cmd+Shift+M)';
            }
            button.setAttribute('title', entry.label + shortcutHint);
            button.setAttribute('aria-label', entry.label + shortcutHint);
            button.innerHTML = iconHtml(entry);
            button.addEventListener('click', entry.action);
            toolbarActions.appendChild(button);
        });

        toolbarToggle = null;
        if (compactToolbar) {
            toolbarToggle = document.createElement('button');
            toolbarToggle.type = 'button';
            toolbarToggle.className = 'button smartreply-btn smartreply-toolbar-btn smartreply-toolbar-toggle';
            toolbarToggle.addEventListener('click', function () {
                toolbarExpanded = !toolbarExpanded;
                updateToolbarState();
            });
            toolbarActions.appendChild(toolbarToggle);
        }

        updateToolbarState();
    }

    function parseTemplates() {
        var node = document.getElementById('smartreply-templates-data');
        if (!node) {
            return [];
        }
        try {
            var parsed = JSON.parse(node.textContent || '[]');
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            return [];
        }
    }

    function renderTemplates() {
        var templates = parseTemplates();
        if (!templates.length) {
            templateBox.hidden = true;
            return;
        }

        templateActions.innerHTML = '';
        templates.forEach(function (entry) {
            if (!entry || !entry.label || !entry.message) {
                return;
            }
            var button = document.createElement('button');
            button.type = 'button';
            button.className = 'smartreply-btn smartreply-template-btn';
            button.textContent = entry.label;
            button.addEventListener('click', function () {
                insertAtCursor(entry.message);
            });
            templateActions.appendChild(button);
        });
        templateBox.hidden = !templateActions.children.length;
    }

    function safeStorageGet() {
        if (!autosaveEnabled || !window.localStorage) {
            return null;
        }
        try {
            return window.localStorage.getItem(storageKey);
        } catch (e) {
            return null;
        }
    }

    function safeStorageSet(value) {
        if (!autosaveEnabled || !window.localStorage) {
            return;
        }
        try {
            window.localStorage.setItem(storageKey, value);
        } catch (e) {
            /* ignore */
        }
    }

    function safeStorageRemove() {
        if (!window.localStorage) {
            return;
        }
        try {
            window.localStorage.removeItem(storageKey);
        } catch (e) {
            /* ignore */
        }
    }

    function persistDraft() {
        if (!autosaveEnabled) {
            return;
        }

        var payload = {
            message: textarea.value,
            context_post_id: contextPostId ? contextPostId.value : '',
            context_post_index: contextPostIndex ? contextPostIndex.value : '',
            context_username: contextUsername ? contextUsername.value : '',
            context_user_colour: contextUserColour ? contextUserColour.value : '',
            context_subject: contextSubject ? contextSubject.value : '',
            context_snippet: contextSnippet ? contextSnippet.value : '',
            context_mode: contextMode ? contextMode.value : 'reply',
            cursor_start: typeof textarea.selectionStart === 'number' ? textarea.selectionStart : null,
            cursor_end: typeof textarea.selectionEnd === 'number' ? textarea.selectionEnd : null,
            saved_at: Date.now()
        };

        if (!payload.message && !payload.context_username) {
            safeStorageRemove();
            saveStatus.textContent = config.dataset.labelReady || '';
            renderStateBar();
            return;
        }

        safeStorageSet(JSON.stringify(payload));
        saveStatus.textContent = getMinimalSavedStatusText();
        renderStateBar();
    }

    function restoreDraft(payload) {
        if (!payload) {
            return;
        }
        textarea.value = payload.message || '';
        if (contextPostId) { contextPostId.value = payload.context_post_id || ''; }
        if (contextPostIndex) { contextPostIndex.value = payload.context_post_index || ''; }
        if (contextUsername) { contextUsername.value = payload.context_username || ''; }
        if (contextUserColour) { contextUserColour.value = payload.context_user_colour || ''; }
        if (contextSubject) { contextSubject.value = payload.context_subject || ''; }
        if (contextSnippet) { contextSnippet.value = payload.context_snippet || ''; }
        if (contextMode) { contextMode.value = payload.context_mode || 'reply'; }
        updateContextBox();
        updatePreview();
        draftBox.hidden = true;
        setDraftReopenVisibility(false);
        if (textarea.value.length) {
            expandComposer(true);
            guideUserToComposer({ block: 'center' });
            focusTextarea(false);
        }
        if (typeof textarea.setSelectionRange === 'function' && typeof payload.cursor_start === 'number' && typeof payload.cursor_end === 'number') {
            var start = Math.max(0, Math.min(payload.cursor_start, textarea.value.length));
            var end = Math.max(start, Math.min(payload.cursor_end, textarea.value.length));
            textarea.setSelectionRange(start, end);
        }
        persistDraft();
        renderStateBar();
    }

    function readSavedDraft() {
        var raw = safeStorageGet();
        if (!raw) {
            return null;
        }
        try {
            return JSON.parse(raw);
        } catch (e) {
            return null;
        }
    }

    function setDraftReopenVisibility(show) {
        if (!reopenDraftBtn) {
            return;
        }
        reopenDraftBtn.hidden = !show;
        reopenDraftBtn.setAttribute('aria-hidden', show ? 'false' : 'true');
        renderStateBar();
    }

    function currentEditorHasContent() {
        return !!String(textarea.value || '').trim();
    }

    function dismissDraftPrompt(payload, statusMessage) {
        draftBox.hidden = true;
        if (payload && (payload.message || payload.context_username)) {
            setDraftReopenVisibility(true);
        } else {
            setDraftReopenVisibility(false);
        }
        if (typeof statusMessage === 'string' && statusMessage !== '') {
            saveStatus.textContent = statusMessage;
        }
        renderStateBar();
    }

    function showDraftPrompt(payload, options) {
        var settings = options || {};
        if (!payload || (!payload.message && !payload.context_username)) {
            draftBox.hidden = true;
            setDraftReopenVisibility(false);
            return;
        }
        if (!settings.force && currentEditorHasContent()) {
            dismissDraftPrompt(payload, config.dataset.labelDraftAvailable || config.dataset.labelDraftReopen || 'Saved draft');
            return;
        }
        var draftSummary = [];
        if (payload.saved_at) {
            draftSummary.push(new Date(payload.saved_at).toLocaleString());
        }
        if (payload.context_username || payload.context_post_index) {
            var previousMode = payload.context_mode || 'reply';
            var previousModeLabel = config.dataset.labelContextNote || 'Replying to';
            if (previousMode === 'quote') {
                previousModeLabel = config.dataset.labelQuotingPost || config.dataset.labelQuoting || 'Quoting';
            } else if (previousMode === 'mention') {
                previousModeLabel = config.dataset.labelMentioningPost || config.dataset.labelMentioning || 'Mentioning';
            }
            draftSummary.push(previousModeLabel + ' ' + buildContextLine(payload.context_username || '', payload.context_post_index || ''));
        }
        draftTitle.textContent = (config.dataset.labelDraftFound || 'Draft found') + (draftSummary.length ? ' · ' + draftSummary.join(' · ') : '');
        draftBox.hidden = false;
        setDraftReopenVisibility(false);
        renderStateBar();
        restoreBtn.onclick = function () {
            restoreDraft(payload);
            setDraftReopenVisibility(false);
            saveStatus.textContent = config.dataset.labelDraftRestored || config.dataset.labelReady || '';
        };
        laterBtn.onclick = function () {
            dismissDraftPrompt(payload, config.dataset.labelDraftAvailable || config.dataset.labelDraftReopen || 'Saved draft');
        };
        discardBtn.onclick = function () {
            safeStorageRemove();
            draftBox.hidden = true;
            setDraftReopenVisibility(false);
            saveStatus.textContent = config.dataset.labelDraftDiscarded || config.dataset.labelReady || '';
            renderStateBar();
        };
    }


    function escapeHtml(text) {
        return String(text || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function normalizeUrl(url) {
        var value = String(url || '').trim();
        if (/^(https?:\/\/|ftp:\/\/|mailto:|\/)/i.test(value)) {
            return value;
        }
        return '';
    }

    function normalizeColor(value) {
        var color = String(value || '').trim();
        if (/^(#[0-9a-f]{3}|#[0-9a-f]{6}|[a-z]{3,20}|rgb\((\s*\d+\s*,){2}\s*\d+\s*\)|rgba\((\s*\d+\s*,){3}\s*(0|0?\.\d+|1)\s*\))$/i.test(color)) {
            return color;
        }
        return '';
    }

    function normalizeSize(value) {
        var size = parseInt(String(value || '').replace(/[^\d]/g, ''), 10);
        if (isNaN(size)) {
            return '';
        }
        if (size < 70) {
            size = 70;
        }
        if (size > 200) {
            size = 200;
        }
        return size + '%';
    }

    function replaceSimplePair(text, tag, openHtml, closeHtml) {
        var regex = new RegExp('\\[' + tag + '\\]([\\s\\S]*?)\\[\\/' + tag + '\\]', 'gi');
        var previous;
        do {
            previous = text;
            text = text.replace(regex, function (match, inner) {
                return openHtml + renderFragment(inner) + closeHtml;
            });
        } while (text !== previous);
        return text;
    }

    function replaceParameterizedPair(text, tag, normalizer, renderer) {
        var regex = new RegExp('\\[' + tag + '=([^\\]]+)\\]([\\s\\S]*?)\\[\\/' + tag + '\\]', 'gi');
        var previous;
        do {
            previous = text;
            text = text.replace(regex, function (match, param, inner) {
                var normalized = normalizer(param);
                if (!normalized) {
                    return renderFragment(inner);
                }
                return renderer(normalized, renderFragment(inner));
            });
        } while (text !== previous);
        return text;
    }

    function escapeRegex(text) {
        return String(text || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function renderSmiliesInPreview(text) {
        if (!smilies.length) {
            return text;
        }

        var orderedSmilies = smilies.slice().sort(function (a, b) {
            return String(b.code || '').length - String(a.code || '').length;
        });

        return String(text || '').split(/(<[^>]+>)/g).map(function (segment) {
            if (!segment || segment.charAt(0) === '<') {
                return segment;
            }

            orderedSmilies.forEach(function (entry) {
                if (!entry || !entry.code || !entry.url) {
                    return;
                }
                var width = parseInt(entry.width, 10) || 0;
                var height = parseInt(entry.height, 10) || 0;
                var sizeAttrs = '';
                if (width > 0) {
                    sizeAttrs += ' width="' + width + '"';
                }
                if (height > 0) {
                    sizeAttrs += ' height="' + height + '"';
                }
                var image = '<img class="smartreply-preview-smiley" src="' + escapeHtml(entry.url) + '" alt="' + escapeHtml(entry.code) + '" title="' + escapeHtml(entry.emotion || entry.code) + '"' + sizeAttrs + ' loading="lazy">';
                segment = segment.replace(new RegExp(escapeRegex(entry.code), 'g'), image);
            });
            return segment;
        }).join('');
    }

    function renderMentions(text) {
        return text.replace(/(^|[\s>(])@([A-Za-z0-9_.\-]{2,32})/g, function (match, prefix, username) {
            return prefix + '<span class="smartreply-preview-mention">@' + username + '</span>';
        });
    }

    function replaceQuotes(text) {
        var regex = /\[quote(?:=&quot;([^\]]*)&quot;|=&#039;([^\]]*)&#039;|=([^\]]+))?\]([\s\S]*?)\[\/quote\]/i;
        var previous;
        do {
            previous = text;
            text = text.replace(regex, function (match, quoted1, quoted2, quoted3, inner) {
                var author = quoted1 || quoted2 || quoted3 || '';
                var cite = author ? '<cite>' + author + '</cite>' : '';
                return '<blockquote class="smartreply-preview-quote">' + cite + renderFragment(inner) + '</blockquote>';
            });
        } while (text !== previous);
        return text;
    }

    function splitListItems(text) {
        var items = [];
        var current = '';
        var depth = 0;
        var i = 0;

        while (i < text.length) {
            if (text.substr(i, 6).toLowerCase() === '[list]') {
                depth += 1;
                current += text.substr(i, 6);
                i += 6;
                continue;
            }
            if (text.substr(i, 7).toLowerCase() === '[/list]') {
                depth = Math.max(0, depth - 1);
                current += text.substr(i, 7);
                i += 7;
                continue;
            }
            if (text.substr(i, 6).toLowerCase().match(/^\[list=/)) {
                var end = text.indexOf(']', i);
                if (end !== -1) {
                    depth += 1;
                    current += text.substring(i, end + 1);
                    i = end + 1;
                    continue;
                }
            }
            if (depth === 0 && text.substr(i, 3) === '[*]') {
                if (current.trim()) {
                    items.push(current.trim());
                }
                current = '';
                i += 3;
                continue;
            }

            current += text.charAt(i);
            i += 1;
        }

        if (current.trim()) {
            items.push(current.trim());
        }

        return items;
    }

    function replaceLists(text) {
        var regex = /\[list(?:=([^\]]+))?\]([\s\S]*?)\[\/list\]/i;
        var previous;
        do {
            previous = text;
            text = text.replace(regex, function (match, mode, inner) {
                var items = splitListItems(inner);
                if (!items.length) {
                    return '';
                }
                var ordered = !!(mode && String(mode).trim() !== '' && String(mode).toLowerCase() !== 'disc');
                var attr = '';
                if (ordered) {
                    var modeValue = String(mode).trim().toLowerCase();
                    if (modeValue === 'a' || modeValue === '1') {
                        attr = ' type="' + modeValue + '"';
                    }
                }
                return '<' + (ordered ? 'ol' : 'ul') + attr + '>' +
                    items.map(function (item) {
                        return '<li>' + renderFragment(item) + '</li>';
                    }).join('') +
                    '</' + (ordered ? 'ol' : 'ul') + '>';
            });
        } while (text !== previous);
        return text;
    }

    function renderFragment(fragment) {
        var output = String(fragment || '');

        output = output.replace(/\[url=([^\]]+)\]([\s\S]*?)\[\/url\]/gi, function (match, url, label) {
            var safe = normalizeUrl(url);
            var textLabel = renderFragment(label);
            if (!safe) {
                return textLabel;
            }
            return '<a href="' + safe + '" target="_blank" rel="noopener noreferrer">' + textLabel + '</a>';
        });

        output = output.replace(/\[url\]([\s\S]*?)\[\/url\]/gi, function (match, url) {
            var safe = normalizeUrl(url);
            var label = escapeHtml(url);
            if (!safe) {
                return label;
            }
            return '<a href="' + safe + '" target="_blank" rel="noopener noreferrer">' + label + '</a>';
        });

        output = replaceLists(output);
        output = replaceQuotes(output);
        output = replaceParameterizedPair(output, 'color', normalizeColor, function (value, html) {
            return '<span style="color:' + value + ';">' + html + '</span>';
        });
        output = replaceParameterizedPair(output, 'size', normalizeSize, function (value, html) {
            return '<span style="font-size:' + value + ';">' + html + '</span>';
        });
        output = replaceSimplePair(output, 'b', '<strong>', '</strong>');
        output = replaceSimplePair(output, 'i', '<em>', '</em>');
        output = replaceSimplePair(output, 'u', '<span style="text-decoration: underline;">', '</span>');
        output = replaceSimplePair(output, 's', '<span style="text-decoration: line-through;">', '</span>');
        output = renderMentions(output);
        output = renderSmiliesInPreview(output);
        output = output.replace(/\n/g, '<br>');

        return output;
    }

    function renderPreview(raw) {
        var text = String(raw || '').replace(/\r\n?/g, '\n');
        if (!text.trim()) {
            return '<div class="smartreply-preview-empty">' + escapeHtml(config.dataset.labelPreviewEmpty || 'Nothing to preview yet.') + '</div>';
        }

        var placeholders = [];
        var escaped = escapeHtml(text);

        escaped = escaped.replace(/\[code\]([\s\S]*?)\[\/code\]/gi, function (match, code) {
            var index = placeholders.length;
            placeholders.push('<pre class="smartreply-preview-code"><code>' + code + '</code></pre>');
            return '@@SMARTREPLY_CODE_' + index + '@@';
        });

        escaped = escaped.replace(/\[img\]([\s\S]*?)\[\/img\]/gi, function (match, url) {
            var safe = normalizeUrl(url);
            var label = escapeHtml(config.dataset.labelPreviewImage || 'Image in final post');
            if (!safe) {
                return '<span class="smartreply-preview-image">' + label + '</span>';
            }
            return '<a class="smartreply-preview-image" href="' + safe + '" target="_blank" rel="noopener noreferrer">' + label + '</a>';
        });

        escaped = renderFragment(escaped);

        escaped = escaped.replace(/@@SMARTREPLY_CODE_(\d+)@@/g, function (match, index) {
            return placeholders[parseInt(index, 10)] || '';
        });

        return escaped;
    }

    function updatePreview(forceOpen) {
        if (typeof forceOpen !== 'undefined' && forceOpen) {
            previewVisible = true;
            previewBox.hidden = false;
            previewToggle.textContent = config.dataset.labelHidePreview || 'Hide preview';
            refreshTooltips();
        }
        if (!previewVisible) {
            return;
        }
        previewBody.innerHTML = renderPreview(textarea.value || '');
    }

    function togglePreview() {
        previewVisible = !previewVisible;
        previewBox.hidden = !previewVisible;
        previewToggle.textContent = previewVisible ? (config.dataset.labelHidePreview || 'Hide preview') : (config.dataset.labelShowPreview || 'Show preview');
        refreshTooltips();
        if (previewVisible) {
            updatePreview(true);
        }
    }

    jumpBtn.addEventListener('click', jumpToOriginPost);
    removeBtn.addEventListener('click', clearContext);
    clearMessageBtn.addEventListener('click', clearMessage);
    reopenDraftBtn.addEventListener('click', function () {
        showDraftPrompt(readSavedDraft(), { force: true });
    });
    previewToggle.addEventListener('click', togglePreview);
    textarea.addEventListener('focus', function () { expandComposer(false); });
    textarea.addEventListener('keydown', handleTextareaShortcuts);
    textarea.addEventListener('input', function () {
        expandComposer(false);
        detectMentionQuery();
        updatePreview();
        persistDraft();
        rememberTextareaHeight();
    });
    textarea.addEventListener('click', detectMentionQuery);
    textarea.addEventListener('keyup', function (event) {
        var key = String(event.key || '').toLowerCase();
        if (key === 'arrowdown' || key === 'arrowup' || key === 'enter' || key === 'tab' || key === 'escape') {
            return;
        }
        detectMentionQuery();
    });
    textarea.addEventListener('blur', function () {
        window.setTimeout(hideMentionBox, 150);
    });
    form.addEventListener('change', function () {
        detectMentionQuery();
        updatePreview();
        persistDraft();
        rememberTextareaHeight();
    });
    textarea.addEventListener('mouseup', rememberTextareaHeight);
    window.addEventListener('mouseup', rememberTextareaHeight);

    document.addEventListener('click', function (event) {
        if (!colorPaletteBox.hidden && !colorPaletteBox.contains(event.target) && !toolbarBox.contains(event.target)) {
            hideColorPalette();
        }
    });

    syncMobilePostActions();

    if (mobileActionsMedia && typeof mobileActionsMedia.addEventListener === 'function') {
        mobileActionsMedia.addEventListener('change', syncMobilePostActions);
    } else {
        window.addEventListener('resize', syncMobilePostActions);
    }

    document.querySelectorAll('.smartreply-trigger').forEach(function (button) {
        button.addEventListener('click', function (event) {
            event.preventDefault();
            applyContext({
                mode: 'reply',
                postId: this.dataset.postId || '',
                postIndex: this.dataset.postIndex || resolvePostIndexFromId(this.dataset.postId || ''),
                username: resolveUsernameFromButton(this) || '',
                userColour: resolveUserColourFromButton(this) || '',
                subject: this.dataset.subject || '',
                snippet: this.dataset.snippet || ''
            });
        });
    });

    document.querySelectorAll('.smartreply-quote-trigger').forEach(function (button) {
        button.addEventListener('click', function (event) {
            event.preventDefault();
            insertQuickQuote({
                mode: 'quote',
                postId: this.dataset.postId || '',
                postIndex: this.dataset.postIndex || resolvePostIndexFromId(this.dataset.postId || ''),
                username: resolveUsernameFromButton(this) || '',
                userColour: resolveUserColourFromButton(this) || '',
                subject: this.dataset.subject || '',
                snippet: this.dataset.snippet || ''
            });
        });
    });

    document.querySelectorAll('.smartreply-mention-trigger').forEach(function (button) {
        button.addEventListener('click', function (event) {
            event.preventDefault();
            insertLightMention({
                mode: 'mention',
                postId: this.dataset.postId || '',
                postIndex: this.dataset.postIndex || resolvePostIndexFromId(this.dataset.postId || ''),
                username: resolveUsernameFromButton(this) || '',
                userColour: resolveUserColourFromButton(this) || '',
                subject: this.dataset.subject || '',
                snippet: this.dataset.snippet || ''
            });
        });
    });

    contextBox.addEventListener('click', function (event) {
        var link = event.target && typeof event.target.closest === 'function'
            ? event.target.closest('.smartreply-context-post-link')
            : null;
        if (!link) {
            return;
        }
        event.preventDefault();
        pulseOriginPost(link.getAttribute('data-post-id') || '', true);
    });

    form.addEventListener('submit', function () {
        rememberTextareaHeight();
        if (persistContext && contextUsername && contextUsername.value && textarea.value.indexOf('[size=85][i]') !== 0) {
            var contextLine = buildContextLine(contextUsername.value, contextPostIndex ? contextPostIndex.value : '');
            var note = '[size=85][i]' + contextLine + '[/i][/size]\n\n';
            textarea.value = note + textarea.value;
        }
        persistDraft();
    });

    buildColorPalette();
    smilies = parseSmilies();
    buildToolbar();
    renderTemplates();
    applyRememberedTextareaHeight(false);
    updatePreview();
    syncActivePostActionButtons();
    updateContextBox();
    refreshTooltips();
    showDraftPrompt(readSavedDraft(), { force: false });
});
