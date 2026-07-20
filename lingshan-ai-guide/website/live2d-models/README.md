# Live2D 数字人模型

请将您的 Live2D 模型文件放入此目录。

## 目录结构

```
live2d-models/
  ling/               # 默认导游模型（小灵）
    model3.json       # Cubism 3/4/5 模型入口
    *.moc3            # 模型文件
    *.texture.png     # 纹理贴图
    *.motion3.json    # 动作文件
    *.exp3.json       # 表情文件
    *.physics3.json   # 物理效果（可选）
    *.pose3.json     # 姿势（可选）
  
  default/            # 备用模型
```

## 使用方式

1. 将您的 Live2D 模型文件夹放入 `live2d-models/ling/`
2. 确保入口文件名为 `model3.json`（Cubism 3/4/5）或 `model.json`（Cubism 2）
3. 刷新页面即可看到数字人导游

## 模型要求

- 支持 Cubism 2 (model.json)、Cubism 3/4/5 (model3.json)
- 推荐使用 Cubism 4/5 格式以获得最佳效果
- 模型应包含至少一个 Idle 动作组用于待机动画

## 无模型时的表现

当 `live2d-models/ling/` 目录下没有模型文件时，
页面右下角会显示一个简洁的导游图标（非 Live2D 模式），
仍可正常使用聊天和景点导览功能。
