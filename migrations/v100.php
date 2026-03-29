<?php
/**
 * @copyright (c) 2026 MundoPHPBB
 * @license GNU General Public License, version 2 (GPL-2.0)
 */

namespace mundophpbb\smartreply\migrations;

class v100 extends \phpbb\db\migration\migration
{
    public function effectively_installed()
    {
        return isset($this->config['mundophpbb_smartreply_enable']);
    }

    static public function depends_on()
    {
        return ['\\phpbb\\db\\migration\\data\\v33x\\v3314'];
    }

    public function update_data()
    {
        return [
            ['config.add', ['mundophpbb_smartreply_enable', 1]],
            ['config.add', ['mundophpbb_smartreply_forums', '']],
            ['config.add', ['mundophpbb_smartreply_auto_expand', 1]],
            ['config.add', ['mundophpbb_smartreply_autosave', 1]],
            ['config.add', ['mundophpbb_smartreply_context_snippet', 1]],
            ['config.add', ['mundophpbb_smartreply_start_open', 0]],
            ['config.add', ['mundophpbb_smartreply_persist_context', 0]],
            ['config.add', ['mundophpbb_smartreply_snippet_length', 140]],

            ['module.add', ['acp', 'ACP_CAT_DOT_MODS', 'ACP_SMARTREPLY_TITLE']],
            ['module.add', ['acp', 'ACP_SMARTREPLY_TITLE', [
                'module_basename' => '\\mundophpbb\\smartreply\\acp\\main_module',
                'modes' => ['settings'],
            ]]],
        ];
    }

    public function revert_data()
    {
        return [
            ['module.remove', ['acp', 'ACP_SMARTREPLY_TITLE', [
                'module_basename' => '\\mundophpbb\\smartreply\\acp\\main_module',
                'modes' => ['settings'],
            ]]],
            ['module.remove', ['acp', 'ACP_CAT_DOT_MODS', 'ACP_SMARTREPLY_TITLE']],
            ['config.remove', ['mundophpbb_smartreply_enable']],
            ['config.remove', ['mundophpbb_smartreply_forums']],
            ['config.remove', ['mundophpbb_smartreply_auto_expand']],
            ['config.remove', ['mundophpbb_smartreply_autosave']],
            ['config.remove', ['mundophpbb_smartreply_context_snippet']],
            ['config.remove', ['mundophpbb_smartreply_start_open']],
            ['config.remove', ['mundophpbb_smartreply_persist_context']],
            ['config.remove', ['mundophpbb_smartreply_snippet_length']],
        ];
    }
}
