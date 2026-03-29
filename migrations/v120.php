<?php
/**
 * @copyright (c) 2026 MundoPHPBB
 * @license GNU General Public License, version 2 (GPL-2.0)
 */

namespace mundophpbb\smartreply\migrations;

class v120 extends \phpbb\db\migration\migration
{
    public function effectively_installed()
    {
        return isset($this->config['mundophpbb_smartreply_forum_templates']);
    }

    static public function depends_on()
    {
        return ['\\mundophpbb\\smartreply\\migrations\\v110'];
    }

    public function update_data()
    {
        return [
            ['config.add', ['mundophpbb_smartreply_forum_templates', '']],
        ];
    }

    public function revert_data()
    {
        return [
            ['config.remove', ['mundophpbb_smartreply_forum_templates']],
        ];
    }
}
