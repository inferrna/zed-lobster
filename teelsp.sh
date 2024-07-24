#!/bin/bash
#rm -r /tmp/lobster-lsp*
#rm /tmp/lsp_{in,err,out,both}.log
echo "Start new log at `date`" > /tmp/lsp_err.log
echo "Start new log at `date`" > /tmp/lsp_in.log
echo "Start new log at `date`" > /tmp/lsp_out.log
NODE_PATH="${HOME}/.local/share/zed/node/node-v18.15.0-linux-x64/bin/node"
LSP_PATH="$(dirname "$0")/lsp/webpack-out/lobster_lsp.js"

#tee >(ts '%.s' >> /tmp/lsp_in.log) | $NODE_PATH $LSP_PATH --stdio 2>>/tmp/lsp_err.log | tee >(ts '%.s' >> /tmp/lsp_out.log)
tee >(awk '{print "Client "$1}' >> /tmp/lsp_both.log) | $NODE_PATH $LSP_PATH --stdio 2>>/tmp/lsp_err.log | tee >(awk '{print "Server "$1}' >> /tmp/lsp_both.log)

