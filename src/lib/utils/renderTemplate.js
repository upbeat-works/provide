import { escape, template as compile } from 'lodash-es';

const settings = {
  escape: /\{\{-(.+?)\}\}/g,
  interpolate: /\{\{(.+?)\}\}/g,
  evaluate: /\{\{=(.+?)\}\}/g,
  imports: { _: { escape } },
};

export default function renderTemplate(template, data) {
  try {
    return compile(template, settings)(data);
  } catch (e) {
    console.error(e);
    return '';
  }
}
