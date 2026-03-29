<?php
/**
 * @copyright (c) 2026 MundoPHPBB
 * @license GNU General Public License, version 2 (GPL-2.0)
 */

namespace mundophpbb\smartreply\acp;

class main_info
{
    public function module()
    {
        return [
            'filename' => '\\mundophpbb\\smartreply\\acp\\main_module',
            'title' => 'ACP_SMARTREPLY_TITLE',
            'modes' => [
                'settings' => [
                    'title' => 'ACP_SMARTREPLY_SETTINGS',
                    'auth' => 'ext_mundophpbb/smartreply && acl_a_board',
                    'cat' => ['ACP_SMARTREPLY_TITLE'],
                ],
            ],
        ];
    }
}
