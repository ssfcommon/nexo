import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info);
  }
  reset = () => this.setState({ error: null });
  render() {
    if (this.state.error) {
      return (
        <div className="card text-center py-10 my-6">
          <div className="text-4xl mb-2">😵</div>
          <p className="text-[16px] font-semibold text-ink-900">Something went wrong</p>
          <p className="text-[13px] text-ink-500 mt-1 mb-4">{String(this.state.error.message || this.state.error)}</p>
          <button onClick={this.reset} className="pill pill-primary">Try again</button>
        </div>
      );
    }
    return this.props.children;
  }
}
