#!/bin/bash
# 委托 job_engine 双引擎停止脚本
exec "$(dirname "$0")/../interview/job_engine/stop_feishu.sh" "$@"
