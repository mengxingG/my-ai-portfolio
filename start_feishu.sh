#!/bin/bash
# 委托 job_engine 双引擎启动脚本（请在任意目录执行均可）
exec "$(dirname "$0")/../interview/job_engine/start_feishu.sh" "$@"
