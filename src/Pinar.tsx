import React from "react";
import {
  AccessibilityInfo,
  Dimensions,
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { Props, State } from "../index";
import { defaultStyles } from "./styles";

const defaultScrollViewProps = {
  horizontal: true,
  pagingEnabled: true,
  bounces: false,
  showsHorizontalScrollIndicator: false,
  showsVerticalScrollIndicator: false,
  scrollsToTop: false,
  removeClippedSubviews: true,
  automaticallyAdjustContentInsets: false,
  scrollEnabled: true
};

const defaultCarouselProps = {
  showsControls: true,
  showsDots: true,
  initialIndex: 0
};

const styles = StyleSheet.create(defaultStyles);

export class Pinar extends React.PureComponent<Props, State> {
  displayName: "Pinar";

  private scrollView: ScrollView | null;

  private internals: { isScrolling: boolean; offset: { x: number; y: number } };

  static defaultProps = { ...defaultScrollViewProps, ...defaultCarouselProps };

  constructor(props: Props) {
    super(props);
    const { height, width } = this.getCarouselDimensions();
    const total = React.Children.toArray(props.children).length;
    const initialIndex = props.initialIndex || 0;
    const lastIndex = total - 1;
    const activePageIndex = total > 1 ? Math.min(initialIndex, lastIndex) : 0;
    const offset = { x: 0, y: 0 };
    this.internals = { isScrolling: false, offset };
    this.state = {
      activePageIndex,
      height,
      width,
      total,
      offset
    };
    this.scrollView = null;
  }

  componentDidMount() {
    const { activePageIndex } = this.state;
    const { initialIndex } = this.props;

    if (initialIndex && initialIndex !== activePageIndex) {
      this.scrollBy(initialIndex, false);
      /* eslint-disable react/no-did-mount-set-state */
      this.setState({ activePageIndex: initialIndex });
      /* eslint-enable react/no-did-mount-set-state */
    }
  }

  componentDidUpdate(prevProps: Props, prevState: State) {
    const { height, width, children } = this.props;
    const needsToUpdateWidth = prevProps.width !== width;
    const needsToUpdateHeight = prevProps.height !== height;
    const total = React.Children.toArray(children).length;
    const needsToUpdateTotal = prevState.total !== total;
    if (needsToUpdateHeight || needsToUpdateWidth || needsToUpdateTotal) {
      /* eslint-disable react/no-did-update-set-state */
      this.setState({ ...this.getCarouselDimensions(), total });
      /* eslint-enable react/no-did-update-set-state */
    }
  }

  private getCarouselDimensions(): { height: number; width: number } {
    const { height, width } = this.props;
    const dimensions = Dimensions.get("window");
    return {
      height: height !== undefined ? height : dimensions.height,
      width: width !== undefined ? width : dimensions.width
    };
  }

  private onScrollBegin(_: NativeSyntheticEvent<NativeScrollEvent>): void {
    this.internals.isScrolling = true;
  }

  onScrollEndDrag(e: NativeSyntheticEvent<NativeScrollEvent>): void {
    const { contentOffset } = e.nativeEvent;
    const { horizontal } = this.props;
    const { activePageIndex, total } = this.state;
    const { offset } = this.internals;
    const previousOffset = horizontal ? offset.x : offset.y;
    const newOffset = horizontal ? contentOffset.x : contentOffset.y;
    const isFirstPage = activePageIndex === 0;
    const isLastPage = activePageIndex === total - 1;

    if (previousOffset === newOffset && (isFirstPage || isLastPage)) {
      this.internals.isScrolling = false;
    }
  }

  private onScrollEnd(e: NativeSyntheticEvent<NativeScrollEvent>): void {
    this.internals.isScrolling = false;

    const { activePageIndex, total, height, width } = this.state;
    const { horizontal, onIndexChanged, loop } = this.props;
    const offset = e.nativeEvent.contentOffset;
    const dir = horizontal ? "x" : "y";
    const step = dir === "x" ? width : height;
    const diff = offset[dir] - this.internals.offset[dir];

    if (!diff) return;

    const nextActivePageIndex = Math.floor(
      activePageIndex + Math.round(diff / step)
    );
    const isIndexSmallerThanFirstPageIndex = nextActivePageIndex <= -1;
    const isIndexBiggerThanLastPageIndex = nextActivePageIndex >= total;
    const needsToUpdateOffset =
      isIndexSmallerThanFirstPageIndex || isIndexBiggerThanLastPageIndex;
    const newState = { activePageIndex: nextActivePageIndex };

    if (loop) {
      if (isIndexSmallerThanFirstPageIndex) {
        newState.activePageIndex = total - 1;
        offset[dir] = step * total;
      } else if (isIndexBiggerThanLastPageIndex) {
        newState.activePageIndex = 0;
        offset[dir] = step;
      }
    }

    this.internals.offset = offset;

    if (typeof onIndexChanged === "function") {
      onIndexChanged(nextActivePageIndex);
    }

    if (needsToUpdateOffset) {
      // when swiping to the beginning of a looping set for the third time,
      // the new offset will be the same as the last one set in state.
      // Setting the offset to the same thing will not do anything,
      // so we increment it by 1 then immediately set it to what it should be,
      // after render.
      const isChangedOffset = offset[dir] !== this.internals.offset[dir];
      if (!isChangedOffset) {
        const newOffset = { x: 0, y: 0 };
        newOffset[dir] = offset[dir] + 1;
        this.setState(
          {
            ...newState,
            offset: newOffset
          },
          () => {
            this.setState({ offset });
          }
        );
      } else {
        this.setState({ ...newState, offset });
      }
    } else {
      this.setState(newState);
    }

    const nextActivePage = nextActivePageIndex + 1;

    if (Platform.OS === "ios") {
      AccessibilityInfo.announceForAccessibility(
        "Changed to page " + nextActivePage
      );
    }
  }

  private isActivePageIndex(index: number): boolean {
    const { activePageIndex, total } = this.state;
    const min = 0;
    const max = total;
    const isCurrentIndex = index === activePageIndex;
    const isSmallerThanMin = index === min && activePageIndex < min;
    const isBiggerThanMax = index === max && activePageIndex > max;
    return isCurrentIndex || isSmallerThanMin || isBiggerThanMax;
  }

  public scrollBy(index: number, animated: boolean = true): void {
    const { total } = this.state;
    const { isScrolling } = this.internals;
    if (this.scrollView === null || isScrolling || total < 2) {
      return;
    }
    const { activePageIndex, width, height } = this.state;
    const { horizontal, loop } = this.props;
    const diff = (loop ? 1 : 0) + index + activePageIndex;
    const min = 0;
    const x = horizontal ? diff * width : min;
    const y = horizontal ? min : diff * height;
    this.scrollView.scrollTo({ animated, x, y });
    this.internals.isScrolling = true;
  }

  private scrollToPrev(): void {
    this.scrollBy(-1);
  }

  private scrollToNext(): void {
    this.scrollBy(1);
  }

  private onLayout(e: LayoutChangeEvent): void {
    const { activePageIndex, total } = this.state;
    // Rename height and width when destructuring
    // to avoid conflicting variable names.
    const { height: propsHeight, width: propsWidth } = this.props;
    const { height: layoutHeight, width: layoutWidth } = e.nativeEvent.layout;
    const width = propsWidth !== undefined ? propsWidth : layoutWidth;
    const height = propsHeight !== undefined ? propsHeight : layoutHeight;

    const initialOffset = { x: 0, y: 0 };
    const offset = initialOffset;
    this.internals.offset = initialOffset;

    if (total > 1) {
      const { horizontal, loop } = this.props;
      const dir = horizontal ? "x" : "y";
      const index = loop ? activePageIndex + 1 : activePageIndex;
      offset[dir] = dir === "x" ? width * index : height * index;
    }

    this.setState({ height, width, offset });
  }

  private renderNextButton(): JSX.Element {
    const { renderNextButton, loop } = this.props;
    const { activePageIndex, total } = this.state;
    const isShown = loop || activePageIndex < total - 1;

    if (isShown) {
      if (typeof renderNextButton === "function") {
        return renderNextButton(this.scrollToNext);
      }
      return (
        <TouchableOpacity
          accessibilityComponentType="button"
          accessibilityLabel="Next"
          accessibilityRole="button"
          accessibilityTraits="button"
          accessible={true}
          onPress={() => this.scrollToNext()}
        >
          <Text accessibilityLabel="Next" style={styles.buttonText}>
            ›
          </Text>
        </TouchableOpacity>
      );
    }
    return <View />;
  }

  private renderPrevButton(): JSX.Element {
    const { renderPrevButton, loop } = this.props;
    const { activePageIndex } = this.state;
    const isShown = loop || activePageIndex > 0;

    if (isShown) {
      if (typeof renderPrevButton === "function") {
        return renderPrevButton(this.scrollToPrev);
      }
      return (
        <TouchableOpacity
          accessibilityComponentType="button"
          accessibilityLabel="Previous"
          accessibilityRole="button"
          accessibilityTraits="button"
          accessible={true}
          onPress={() => this.scrollToPrev()}
        >
          <Text accessibilityLabel="Previous" style={styles.buttonText}>
            ‹
          </Text>
        </TouchableOpacity>
      );
    }
    return <View />;
  }

  private refScrollView(view: ScrollView | null): void {
    if (view === null) {
      return;
    }
    this.scrollView = view;
  }

  private renderControls(): JSX.Element {
    const { renderControls } = this.props;

    if (typeof renderControls === "function") {
      return renderControls();
    }

    const { height, width } = this.state;
    const { controlsContainerStyle } = this.props;

    const defaultControlsContainerStyle = [
      styles.controlsContainer,
      { height, width }
    ];
    return (
      <View
        pointerEvents="box-none"
        style={controlsContainerStyle || defaultControlsContainerStyle}
      >
        {this.renderPrevButton()}
        {this.renderNextButton()}
      </View>
    );
  }

  private renderDots(): JSX.Element {
    const { renderDots } = this.props;

    if (typeof renderDots === "function") {
      const { activePageIndex, total } = this.state;
      return renderDots(activePageIndex, total, this);
    }

    const {
      children,
      dotsContainerStyle,
      horizontal,
      renderActiveDot,
      renderDot
    } = this.props;
    const defaultDotsContainerStyle = horizontal
      ? styles.dotsContainerHorizontal
      : styles.dotsContainerVertical;

    return (
      <View style={dotsContainerStyle || defaultDotsContainerStyle}>
        {React.Children.map(children, (_: React.ReactChild, i: number) => {
          const isActive = this.isActivePageIndex(i);
          if (isActive && typeof renderActiveDot === "function") {
            return renderActiveDot();
          }
          if (typeof renderDot === "function") {
            return renderDot();
          }
          const { dotStyle, activeDotStyle } = this.props;
          const style = isActive
            ? activeDotStyle || styles.dotActive
            : dotStyle || styles.dot;
          return <View key={i} style={style} />;
        })}
      </View>
    );
  }

  private renderChildren(children: React.ReactNode): React.ReactNode {
    const { height, width, total } = this.state;
    const { loop } = this.props;
    const needsToLoop = loop && total > 1;
    const childrenArray = React.Children.toArray(children);
    const keys: string[] = Object.keys(childrenArray);

    if (needsToLoop) {
      // To support seamless looping:
      // - add the last page index to the beginning of the array
      // - add the first page index to the end of the array
      const firstPageIndex = 0;
      const lastPageIndex = total - 1;
      keys.unshift(String(lastPageIndex));
      keys.push(String(firstPageIndex));
    }

    return keys.map((key: string, i: number) => {
      /* eslint-disable react-native-a11y/accessibility-label */
      return (
        <View accessible={true} key={i} style={{ height, width }}>
          {childrenArray[Number(key)]}
        </View>
      );
      /* eslint-enable react-native-a11y/accessibility-label */
    });
  }

  render(): JSX.Element {
    const {
      bounces,
      children,
      horizontal,
      pagingEnabled,
      showsControls,
      showsHorizontalScrollIndicator,
      showsDots,
      showsVerticalScrollIndicator,
      scrollsToTop,
      removeClippedSubviews,
      automaticallyAdjustContentInsets,
      scrollEnabled,
      width,
      height
    } = this.props;
    const { offset } = this.state;

    return (
      <View onLayout={e => this.onLayout(e)} style={styles.wrapper}>
        <View style={{ height, width }}>
          <ScrollView
            automaticallyAdjustContentInsets={automaticallyAdjustContentInsets}
            bounces={bounces}
            contentOffset={offset}
            horizontal={horizontal}
            onMomentumScrollEnd={e => this.onScrollEnd(e)}
            onScrollBeginDrag={e => this.onScrollBegin(e)}
            onScrollEndDrag={e => this.onScrollEndDrag(e)}
            pagingEnabled={pagingEnabled}
            ref={view => this.refScrollView(view)}
            removeClippedSubviews={removeClippedSubviews}
            scrollEnabled={scrollEnabled}
            scrollEventThrottle={16}
            scrollsToTop={scrollsToTop}
            showsHorizontalScrollIndicator={showsHorizontalScrollIndicator}
            showsVerticalScrollIndicator={showsVerticalScrollIndicator}
          >
            {this.renderChildren(children)}
          </ScrollView>
          {showsDots && this.renderDots()}
          {showsControls && this.renderControls()}
        </View>
      </View>
    );
  }
}
