/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import type {Klass, LexicalNode} from 'lexical';

import {CodeHighlightNode, CodeNode} from '../../../lexical/packages/lexical-code/src/index';
import {HashtagNode} from '../../../lexical/packages/lexical-hashtag/src/index';
import {AutoLinkNode, LinkNode} from '../../../lexical/packages/lexical-link/src/index';
import {ListItemNode, ListNode} from '../../../lexical/packages/lexical-list/src/index';
import {MarkNode} from '../../../lexical/packages/lexical-mark/src/index';
import {OverflowNode} from '../../../lexical/packages/lexical-overflow/src/index';
import {HorizontalRuleNode} from '../../../lexical/packages/lexical-react/src/index';
import {HeadingNode, QuoteNode} from '../../../lexical/packages/lexical-rich-text/src/index';
import {TableCellNode, TableNode, TableRowNode} from '../../../lexical/packages/lexical-table/src/index';

import {CollapsibleContainerNode} from '../plugins/CollapsiblePlugin/CollapsibleContainerNode';
import {CollapsibleContentNode} from '../plugins/CollapsiblePlugin/CollapsibleContentNode';
import {CollapsibleTitleNode} from '../plugins/CollapsiblePlugin/CollapsibleTitleNode';
import {AutocompleteNode} from './AutocompleteNode';
import {DateTimeNode} from './DateTimeNode/DateTimeNode';
import {EmojiNode} from './EmojiNode';
import {EquationNode} from './EquationNode';
import {ExcalidrawNode} from './ExcalidrawNode';
import {FigmaNode} from './FigmaNode';
import {ImageNode} from './ImageNode';
import {KeywordNode} from './KeywordNode';
import {LayoutContainerNode} from './LayoutContainerNode';
import {LayoutItemNode} from './LayoutItemNode';
import {MentionNode} from './MentionNode';
import {PageBreakNode} from './PageBreakNode';
import {PollNode} from './PollNode';
import {SpecialTextNode} from './SpecialTextNode';
import {StickyNode} from './StickyNode';
import {TweetNode} from './TweetNode';
import {YouTubeNode} from './YouTubeNode';

const PlaygroundNodes: Array<Klass<LexicalNode>> = [
  HeadingNode,
  ListNode,
  ListItemNode,
  QuoteNode,
  CodeNode,
  TableNode,
  TableCellNode,
  TableRowNode,
  HashtagNode,
  CodeHighlightNode,
  AutoLinkNode,
  LinkNode,
  OverflowNode,
  PollNode,
  StickyNode,
  ImageNode,
  MentionNode,
  EmojiNode,
  ExcalidrawNode,
  EquationNode,
  AutocompleteNode,
  KeywordNode,
  HorizontalRuleNode,
  TweetNode,
  YouTubeNode,
  FigmaNode,
  MarkNode,
  CollapsibleContainerNode,
  CollapsibleContentNode,
  CollapsibleTitleNode,
  PageBreakNode,
  LayoutContainerNode,
  LayoutItemNode,
  SpecialTextNode,
  DateTimeNode,
];

export default PlaygroundNodes;
