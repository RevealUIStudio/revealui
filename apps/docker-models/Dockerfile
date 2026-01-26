FROM ghcr.io/huggingface/text-generation-inference:latest

ENV MODEL_ID=mistralai/Mistral-7B-Instruct-v0.2
ENV NUM_SHARD=1
ENV MAX_INPUT_LENGTH=4096
ENV MAX_TOTAL_TOKENS=8192

CMD ["text-generation-launcher"]
