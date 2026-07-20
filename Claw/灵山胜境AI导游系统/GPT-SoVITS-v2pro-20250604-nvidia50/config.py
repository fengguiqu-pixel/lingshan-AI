class Config:
    def __init__(self):
        self.sovits_path = ""
        self.gpt_path = ""
        self.pretrained_sovits_path = "SoVITS_weights_v3/March7th_v3_e2_s200.pth"
        self.pretrained_gpt_path = "GPT_weights_v3/March7th_v3-e15.ckpt"
        self.cnhubert_path = "GPT_SoVITS/pretrained_models/chinese-hubert-base"
        self.bert_path = "GPT_SoVITS/pretrained_models/chinese-roberta-wwm-ext-large"
        self.infer_device = "cuda"
        self.api_port = 9880
        self.is_half = True
