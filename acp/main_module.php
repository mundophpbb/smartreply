<?php
/**
 * @copyright (c) 2026 MundoPHPBB
 * @license GNU General Public License, version 2 (GPL-2.0)
 */

namespace mundophpbb\smartreply\acp;

class main_module
{
    public $u_action;
    public $tpl_name;
    public $page_title;

    public function main($id, $mode)
    {
        global $config, $request, $template, $user;

        $user->add_lang_ext('mundophpbb/smartreply', 'common');

        $this->tpl_name = 'acp_smartreply_body';
        $this->page_title = $user->lang('ACP_SMARTREPLY_SETTINGS');

        add_form_key('mundophpbb_smartreply');

        if ($request->is_set_post('submit'))
        {
            if (!check_form_key('mundophpbb_smartreply'))
            {
                trigger_error('FORM_INVALID');
            }

            $forums_raw = trim($request->variable('mundophpbb_smartreply_forums', '', true));
            $forums = $this->sanitize_forum_ids($forums_raw);
            $snippet_length = max(40, min(400, (int) $request->variable('mundophpbb_smartreply_snippet_length', 140)));
            $templates_raw = trim($request->variable('mundophpbb_smartreply_templates', '', true));
            $templates = $this->sanitize_templates($templates_raw);
            $forum_templates_raw = trim($request->variable('mundophpbb_smartreply_forum_templates', '', true));
            $forum_templates = $this->sanitize_forum_templates($forum_templates_raw);

            if ($forums_raw !== '' && !preg_match('/^[0-9,\s]+$/', $forums_raw))
            {
                trigger_error($user->lang('ACP_SMARTREPLY_FORUMS_INVALID') . adm_back_link($this->u_action), E_USER_WARNING);
            }

            if ($templates_raw !== '' && $templates === false)
            {
                trigger_error($user->lang('ACP_SMARTREPLY_TEMPLATES_INVALID') . adm_back_link($this->u_action), E_USER_WARNING);
            }

            if ($forum_templates_raw !== '' && $forum_templates === false)
            {
                trigger_error($user->lang('ACP_SMARTREPLY_FORUM_TEMPLATES_INVALID') . adm_back_link($this->u_action), E_USER_WARNING);
            }

            $config->set('mundophpbb_smartreply_enable', $request->variable('mundophpbb_smartreply_enable', 1));
            $config->set('mundophpbb_smartreply_forums', $forums);
            $config->set('mundophpbb_smartreply_auto_expand', $request->variable('mundophpbb_smartreply_auto_expand', 1));
            $config->set('mundophpbb_smartreply_autosave', $request->variable('mundophpbb_smartreply_autosave', 1));
            $config->set('mundophpbb_smartreply_context_snippet', $request->variable('mundophpbb_smartreply_context_snippet', 1));
            $config->set('mundophpbb_smartreply_start_open', $request->variable('mundophpbb_smartreply_start_open', 0));
            $config->set('mundophpbb_smartreply_persist_context', $request->variable('mundophpbb_smartreply_persist_context', 0));
            $config->set('mundophpbb_smartreply_enable_context_reply', $request->variable('mundophpbb_smartreply_enable_context_reply', 1));
            $config->set('mundophpbb_smartreply_compact_toolbar', $request->variable('mundophpbb_smartreply_compact_toolbar', 1));
            $config->set('mundophpbb_smartreply_enable_quick_quote', $request->variable('mundophpbb_smartreply_enable_quick_quote', 1));
            $config->set('mundophpbb_smartreply_enable_mention_button', $request->variable('mundophpbb_smartreply_enable_mention_button', 1));
            $config->set('mundophpbb_smartreply_show_post_button_labels', $request->variable('mundophpbb_smartreply_show_post_button_labels', 1));
            $config->set('mundophpbb_smartreply_snippet_length', $snippet_length);
            $config->set('mundophpbb_smartreply_templates', $templates ?: '');
            $config->set('mundophpbb_smartreply_forum_templates', $forum_templates ?: '');

            trigger_error($user->lang('ACP_SMARTREPLY_SAVED') . adm_back_link($this->u_action));
        }

        $template->assign_vars([
            'U_ACTION' => $this->u_action,
            'SMARTREPLY_ENABLE' => (int) $config['mundophpbb_smartreply_enable'],
            'SMARTREPLY_FORUMS' => (string) $config['mundophpbb_smartreply_forums'],
            'SMARTREPLY_AUTO_EXPAND' => (int) $config['mundophpbb_smartreply_auto_expand'],
            'SMARTREPLY_AUTOSAVE' => (int) $config['mundophpbb_smartreply_autosave'],
            'SMARTREPLY_CONTEXT_SNIPPET' => (int) $config['mundophpbb_smartreply_context_snippet'],
            'SMARTREPLY_START_OPEN' => (int) $config['mundophpbb_smartreply_start_open'],
            'SMARTREPLY_PERSIST_CONTEXT' => (int) $config['mundophpbb_smartreply_persist_context'],
            'SMARTREPLY_ENABLE_CONTEXT_REPLY' => (int) (isset($config['mundophpbb_smartreply_enable_context_reply']) ? $config['mundophpbb_smartreply_enable_context_reply'] : 1),
            'SMARTREPLY_COMPACT_TOOLBAR' => (int) (isset($config['mundophpbb_smartreply_compact_toolbar']) ? $config['mundophpbb_smartreply_compact_toolbar'] : 1),
            'SMARTREPLY_ENABLE_QUICK_QUOTE' => (int) (isset($config['mundophpbb_smartreply_enable_quick_quote']) ? $config['mundophpbb_smartreply_enable_quick_quote'] : 1),
            'SMARTREPLY_ENABLE_MENTION_BUTTON' => (int) (isset($config['mundophpbb_smartreply_enable_mention_button']) ? $config['mundophpbb_smartreply_enable_mention_button'] : 1),
            'SMARTREPLY_SHOW_POST_BUTTON_LABELS' => (int) (isset($config['mundophpbb_smartreply_show_post_button_labels']) ? $config['mundophpbb_smartreply_show_post_button_labels'] : 1),
            'SMARTREPLY_SNIPPET_LENGTH' => (int) $config['mundophpbb_smartreply_snippet_length'],
            'SMARTREPLY_TEMPLATES' => (string) (isset($config['mundophpbb_smartreply_templates']) ? $config['mundophpbb_smartreply_templates'] : ''),
            'SMARTREPLY_FORUM_TEMPLATES' => (string) (isset($config['mundophpbb_smartreply_forum_templates']) ? $config['mundophpbb_smartreply_forum_templates'] : ''),
        ]);
    }

    protected function sanitize_forum_ids($value)
    {
        if ($value === '')
        {
            return '';
        }

        $ids = preg_split('/\s*,\s*/', $value);
        $ids = array_filter(array_map('intval', $ids));
        $ids = array_values(array_unique($ids));

        return implode(',', $ids);
    }

    protected function sanitize_templates($value)
    {
        if ($value === '')
        {
            return '';
        }

        $lines = preg_split('/\r\n|\r|\n/', $value);
        $result = [];

        foreach ($lines as $line)
        {
            $line = trim($line);
            if ($line === '')
            {
                continue;
            }

            $parts = explode('|', $line, 2);
            $label = trim($parts[0]);
            $message = trim(isset($parts[1]) ? $parts[1] : $parts[0]);

            if ($label === '' || $message === '')
            {
                return false;
            }

            $label = preg_replace('/\s+/u', ' ', $label);
            if (!$this->validate_template_lengths($label, $message))
            {
                return false;
            }

            $result[] = $label . '|' . $message;

            if (count($result) >= 12)
            {
                break;
            }
        }

        return implode("\n", $result);
    }

    protected function sanitize_forum_templates($value)
    {
        if ($value === '')
        {
            return '';
        }

        $lines = preg_split('/\r\n|\r|\n/', $value);
        $result = [];

        foreach ($lines as $line)
        {
            $line = trim($line);
            if ($line === '')
            {
                continue;
            }

            $parts = explode('|', $line, 3);
            if (count($parts) < 3)
            {
                return false;
            }

            $forum_ids = $this->sanitize_forum_ids($parts[0]);
            $label = trim($parts[1]);
            $message = trim($parts[2]);

            if ($forum_ids === '' || $label === '' || $message === '')
            {
                return false;
            }

            $label = preg_replace('/\s+/u', ' ', $label);
            if (!$this->validate_template_lengths($label, $message))
            {
                return false;
            }

            $result[] = $forum_ids . '|' . $label . '|' . $message;

            if (count($result) >= 60)
            {
                break;
            }
        }

        return implode("\n", $result);
    }

    protected function validate_template_lengths($label, $message)
    {
        if (function_exists('utf8_strlen'))
        {
            return utf8_strlen($label) <= 40 && utf8_strlen($message) <= 500;
        }

        return strlen($label) <= 40 && strlen($message) <= 500;
    }
}
