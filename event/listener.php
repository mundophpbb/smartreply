<?php
/**
 * @copyright (c) 2026 MundoPHPBB
 * @license GNU General Public License, version 2 (GPL-2.0)
 */

namespace mundophpbb\smartreply\event;

use phpbb\auth\auth;
use phpbb\config\config;
use phpbb\controller\helper;
use phpbb\db\driver\driver_interface;
use phpbb\template\template;
use phpbb\user;
use Symfony\Component\EventDispatcher\EventSubscriberInterface;

class listener implements EventSubscriberInterface
{
    /** @var config */
    protected $config;

    /** @var template */
    protected $template;

    /** @var user */
    protected $user;

    /** @var auth */
    protected $auth;

    /** @var helper */
    protected $helper;

    /** @var driver_interface */
    protected $db;

    /** @var string */
    protected $root_path;

    /** @var string */
    protected $php_ext;

    public function __construct(config $config, template $template, user $user, auth $auth, helper $helper, driver_interface $db, $root_path, $php_ext)
    {
        $this->config = $config;
        $this->template = $template;
        $this->user = $user;
        $this->auth = $auth;
        $this->helper = $helper;
        $this->db = $db;
        $this->root_path = $root_path;
        $this->php_ext = $php_ext;
    }

    static public function getSubscribedEvents()
    {
        return [
            'core.user_setup' => 'load_language_on_setup',
            'core.viewtopic_assign_template_vars_before' => 'viewtopic_assign_template_vars_before',
            'core.viewtopic_modify_quick_reply_template_vars' => 'viewtopic_modify_quick_reply_template_vars',
            'core.viewtopic_modify_post_row' => 'viewtopic_modify_post_row',
        ];
    }

    public function load_language_on_setup($event)
    {
        $lang_set_ext = $event['lang_set_ext'];
        $lang_set_ext[] = [
            'ext_name' => 'mundophpbb/smartreply',
            'lang_set' => 'common',
        ];
        $event['lang_set_ext'] = $lang_set_ext;
    }

    public function viewtopic_assign_template_vars_before($event)
    {
        $topic_data = $event['topic_data'];
        $forum_id = (int) $event['forum_id'];
        $enabled = $this->can_use_smartreply($forum_id, $topic_data);

        $this->template->assign_vars([
            'S_SMARTREPLY_ENABLED' => $enabled,
            'S_SMARTREPLY_AUTO_EXPAND' => $enabled && !empty($this->config['mundophpbb_smartreply_auto_expand']),
            'S_SMARTREPLY_AUTOSAVE' => $enabled && !empty($this->config['mundophpbb_smartreply_autosave']),
            'S_SMARTREPLY_SHOW_SNIPPET' => $enabled && !empty($this->config['mundophpbb_smartreply_context_snippet']),
            'S_SMARTREPLY_START_OPEN' => $enabled && !empty($this->config['mundophpbb_smartreply_start_open']),
            'S_SMARTREPLY_PERSIST_CONTEXT' => $enabled && !empty($this->config['mundophpbb_smartreply_persist_context']),
            'S_SMARTREPLY_COMPACT_TOOLBAR' => $enabled && !empty($this->config['mundophpbb_smartreply_compact_toolbar']),
            'S_SMARTREPLY_QUICK_QUOTE_ENABLED' => $enabled && (!isset($this->config['mundophpbb_smartreply_enable_quick_quote']) || !empty($this->config['mundophpbb_smartreply_enable_quick_quote'])),
            'S_SMARTREPLY_MENTION_BUTTON_ENABLED' => $enabled && (!isset($this->config['mundophpbb_smartreply_enable_mention_button']) || !empty($this->config['mundophpbb_smartreply_enable_mention_button'])),
            'S_SMARTREPLY_POST_BUTTON_LABELS' => $enabled && (!isset($this->config['mundophpbb_smartreply_show_post_button_labels']) || !empty($this->config['mundophpbb_smartreply_show_post_button_labels'])),
            'SMARTREPLY_TOPIC_ID' => (int) $topic_data['topic_id'],
            'SMARTREPLY_FULL_EDITOR_URL' => append_sid("{$this->root_path}posting.{$this->php_ext}", 'mode=reply&f=' . $forum_id . '&t=' . (int) $topic_data['topic_id']),
            'SMARTREPLY_TEMPLATES_JSON' => $enabled ? json_encode($this->quick_templates($forum_id), JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_UNESCAPED_UNICODE) : '[]',
            'SMARTREPLY_SMILIES_JSON' => $enabled ? json_encode($this->posting_smilies(), JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_UNESCAPED_UNICODE) : '[]',
        ]);
    }

    public function viewtopic_modify_quick_reply_template_vars($event)
    {
        $topic_data = $event['topic_data'];
        $forum_id = (int) $event['forum_id'];

        if (!$this->can_use_smartreply($forum_id, $topic_data))
        {
            return;
        }

        $tpl_ary = $event['tpl_ary'];
        $tpl_ary['QR_HIDDEN_FIELDS'] .= build_hidden_fields([
            'sr_context_post_id' => '',
            'sr_context_post_index' => '',
            'sr_context_username' => '',
            'sr_context_subject' => '',
            'sr_context_snippet' => '',
        ]);
        $event['tpl_ary'] = $tpl_ary;
    }

    public function viewtopic_modify_post_row($event)
    {
        $topic_data = $event['topic_data'];
        $forum_id = (int) $topic_data['forum_id'];

        if (!$this->can_use_smartreply($forum_id, $topic_data))
        {
            return;
        }

        $post_row = $event['post_row'];
        $row = $event['row'];
        $post_row = array_merge($post_row, [
            'S_SMARTREPLY_REPLY' => !empty($post_row['U_QUOTE']),
            'SMARTREPLY_POST_ID' => (int) $row['post_id'],
            'SMARTREPLY_USERNAME' => $this->escape_attr($this->post_username($row)),
            'SMARTREPLY_USER_COLOUR' => $this->escape_attr($this->post_user_colour($row)),
            'SMARTREPLY_POST_SUBJECT' => $this->escape_attr(isset($row['post_subject']) ? (string) $row['post_subject'] : ''),
            'SMARTREPLY_SNIPPET' => $this->escape_attr($this->extract_message_snippet(isset($post_row['MESSAGE']) ? (string) $post_row['MESSAGE'] : '', (int) $this->config['mundophpbb_smartreply_snippet_length'])),
        ]);
        $event['post_row'] = $post_row;
    }

    protected function can_use_smartreply($forum_id, array $topic_data)
    {
        if (!$this->extension_enabled())
        {
            return false;
        }

        if (!$this->forum_enabled($forum_id))
        {
            return false;
        }

        if (empty($this->config['allow_quick_reply']))
        {
            return false;
        }

        if (empty($topic_data['forum_flags']) || !(($topic_data['forum_flags']) & FORUM_FLAG_QUICK_REPLY))
        {
            return false;
        }

        if ((int) $topic_data['forum_status'] !== ITEM_UNLOCKED || (int) $topic_data['topic_status'] !== ITEM_UNLOCKED)
        {
            return false;
        }

        return $this->auth->acl_get('f_reply', $forum_id);
    }

    protected function extension_enabled()
    {
        return !empty($this->config['mundophpbb_smartreply_enable']);
    }

    protected function forum_enabled($forum_id)
    {
        $raw = isset($this->config['mundophpbb_smartreply_forums']) ? trim((string) $this->config['mundophpbb_smartreply_forums']) : '';
        if ($raw === '')
        {
            return true;
        }

        $ids = array_filter(array_map('intval', preg_split('/\s*,\s*/', $raw)));
        return in_array((int) $forum_id, $ids, true);
    }

    protected function quick_templates($forum_id)
    {
        $templates = [];
        $seen = [];

        foreach ($this->forum_quick_templates($forum_id) as $entry)
        {
            $key = md5($entry['label'] . "\n" . $entry['message']);
            $seen[$key] = true;
            $templates[] = $entry;
        }

        foreach ($this->global_quick_templates() as $entry)
        {
            $key = md5($entry['label'] . "\n" . $entry['message']);
            if (isset($seen[$key]))
            {
                continue;
            }
            $templates[] = $entry;
            $seen[$key] = true;

            if (count($templates) >= 18)
            {
                break;
            }
        }

        return $templates;
    }

    protected function global_quick_templates()
    {
        $raw = isset($this->config['mundophpbb_smartreply_templates']) ? trim((string) $this->config['mundophpbb_smartreply_templates']) : '';
        return $this->parse_global_templates($raw);
    }


    protected function posting_smilies()
    {
        if (!defined('SMILIES_TABLE'))
        {
            return [];
        }

        $smilies = [];
        $seen_codes = [];
        $seen_files = [];
        $smilies_path = isset($this->config['smilies_path']) ? trim((string) $this->config['smilies_path'], '/') : 'images/smilies';

        $sql = 'SELECT code, emotion, smiley_url, smiley_width, smiley_height
            FROM ' . SMILIES_TABLE . '
            WHERE display_on_posting = 1
            ORDER BY smiley_order ASC';
        $result = $this->db->sql_query($sql);

        while (($row = $this->db->sql_fetchrow($result)) && count($smilies) < 80)
        {
            $code = trim((string) $row['code']);
            $file = trim((string) $row['smiley_url']);

            $file_key = strtolower($file);
            $code_key = strtolower($code);

            if ($code === '' || $file === '' || isset($seen_codes[$code_key]) || isset($seen_files[$file_key]))
            {
                continue;
            }

            $seen_codes[$code_key] = true;
            $seen_files[$file_key] = true;
            $smilies[] = [
                'code' => $code,
                'emotion' => (string) $row['emotion'],
                'url' => $this->root_path . $smilies_path . '/' . $file,
                'width' => (int) $row['smiley_width'],
                'height' => (int) $row['smiley_height'],
            ];
        }
        $this->db->sql_freeresult($result);

        return $smilies;
    }

    protected function forum_quick_templates($forum_id)
    {
        $raw = isset($this->config['mundophpbb_smartreply_forum_templates']) ? trim((string) $this->config['mundophpbb_smartreply_forum_templates']) : '';
        if ($raw === '')
        {
            return [];
        }

        $templates = [];
        foreach (preg_split('/\r\n|\r|\n/', $raw) as $line)
        {
            $line = trim($line);
            if ($line === '')
            {
                continue;
            }

            $parts = explode('|', $line, 3);
            if (count($parts) < 3)
            {
                continue;
            }

            $ids = array_filter(array_map('intval', preg_split('/\s*,\s*/', trim($parts[0]))));
            if (!in_array((int) $forum_id, $ids, true))
            {
                continue;
            }

            $label = trim($parts[1]);
            $message = trim($parts[2]);
            if ($label === '' || $message === '')
            {
                continue;
            }

            $templates[] = [
                'label' => $label,
                'message' => $message,
            ];

            if (count($templates) >= 18)
            {
                break;
            }
        }

        return $templates;
    }

    protected function parse_global_templates($raw)
    {
        if ($raw === '')
        {
            return [];
        }

        $templates = [];
        foreach (preg_split('/\r\n|\r|\n/', $raw) as $line)
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
                continue;
            }

            $templates[] = [
                'label' => $label,
                'message' => $message,
            ];

            if (count($templates) >= 12)
            {
                break;
            }
        }

        return $templates;
    }

    protected function post_username(array $row)
    {
        if (!empty($row['username']))
        {
            return (string) $row['username'];
        }

        if (!empty($row['post_username']))
        {
            return (string) $row['post_username'];
        }

        return (string) $this->user->lang('GUEST');
    }

    protected function post_user_colour(array $row)
    {
        if (!empty($row['user_colour']))
        {
            return ltrim((string) $row['user_colour'], '#');
        }

        return '';
    }

    protected function extract_message_snippet($html, $limit)
    {
        $text = trim(html_entity_decode(strip_tags($html), ENT_QUOTES | ENT_HTML5, 'UTF-8'));
        $text = preg_replace('/\s+/u', ' ', $text);
        if ($text === '')
        {
            return '';
        }

        $length = function_exists('utf8_strlen') ? utf8_strlen($text) : strlen($text);
        if ($length <= $limit)
        {
            return $text;
        }

        $cut = function_exists('utf8_substr') ? utf8_substr($text, 0, $limit - 1) : substr($text, 0, $limit - 1);
        return rtrim($cut) . '…';
    }

    protected function escape_attr($value)
    {
        return htmlspecialchars((string) $value, ENT_COMPAT, 'UTF-8');
    }
}
